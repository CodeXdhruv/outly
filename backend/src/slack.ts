import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from './config.js';
import { prisma } from './db.js';
import { redis } from './redis.js';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';

export function encryptToken(text: string): string {
  const key = Buffer.from(config.TOKEN_ENCRYPTION_KEY, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptToken(encryptedString: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedString.split(':');
  const key = Buffer.from(config.TOKEN_ENCRYPTION_KEY, 'base64');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function signSlackState(userId: string): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = JSON.stringify({ userId, nonce, exp });
  const payloadBase64 = Buffer.from(payload).toString('base64url');
  const hmac = crypto.createHmac('sha256', config.SESSION_SECRET).update(payloadBase64).digest('base64url');
  return { state: `${payloadBase64}.${hmac}`, nonce };
}

export function verifySlackState(stateString: string): { userId: string; nonce: string } | null {
  try {
    const [payloadBase64, hmac] = stateString.split('.');
    if (!payloadBase64 || !hmac) return null;

    const expectedHmac = crypto.createHmac('sha256', config.SESSION_SECRET).update(payloadBase64).digest('base64url');
    if (hmac !== expectedHmac) return null;

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) return null;

    return { userId: payload.userId, nonce: payload.nonce };
  } catch {
    return null;
  }
}

export async function notifyLimitHit(params: {
  senderId: string;
  fromEmail: string;
  limit: number;
  retryAt: number;
}) {
  const { senderId, fromEmail, limit, retryAt } = params;
  const hourStart = new Date(Math.floor(Date.now() / 3600000) * 3600000);

  try {
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
      include: {
        user: {
          include: { slack: true },
        },
      },
    });

    if (!sender) return;

    // Deduplicate event per sender + hour window
    const existing = await prisma.rateLimitEvent.findUnique({
      where: {
        senderId_eventType_hourWindowStart: {
          senderId,
          eventType: 'HOURLY_LIMIT_HIT',
          hourWindowStart: hourStart,
        },
      },
    });

    if (existing) {
      return; // Already notified or recorded this hour
    }

    const slackConn = sender.user.slack;
    if (!slackConn || slackConn.revokedAt) {
      await prisma.rateLimitEvent.create({
        data: {
          senderId,
          eventType: 'HOURLY_LIMIT_HIT',
          hourWindowStart: hourStart,
          status: 'skipped_no_slack',
        },
      });
      return;
    }

    let webhookUrl: string;
    try {
      webhookUrl = decryptToken(slackConn.encryptedWebhookUrl);
    } catch (e) {
      logger.error(e, 'Failed to decrypt Slack webhook URL');
      return;
    }

    const retryDate = new Date(retryAt);
    const retryTimeStr = `${String(retryDate.getUTCHours()).padStart(2, '0')}:${String(
      retryDate.getUTCMinutes()
    ).padStart(2, '0')} UTC`;

    const messageText = `:warning: Hourly limit reached for sender ${fromEmail} (${limit}/hour). Remaining emails are deferred to ${retryTimeStr}.`;

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: messageText }),
    });

    if (!resp.ok) {
      if ([404, 403, 410].includes(resp.status)) {
        await prisma.slackConnection.update({
          where: { id: slackConn.id },
          data: { revokedAt: new Date() },
        });
      }

      await prisma.rateLimitEvent.create({
        data: {
          senderId,
          eventType: 'HOURLY_LIMIT_HIT',
          hourWindowStart: hourStart,
          status: 'failed',
        },
      });
      return;
    }

    await prisma.rateLimitEvent.create({
      data: {
        senderId,
        eventType: 'HOURLY_LIMIT_HIT',
        hourWindowStart: hourStart,
        status: 'notified',
      },
    });
  } catch (err) {
    logger.error(err, 'Error in notifyLimitHit');
  }
}

export function setupSlackRoutes(app: any) {
  app.get('/integrations/slack/connect', async (req: Request, res: Response) => {
    if (!req.session?.user) {
      res.redirect(`${config.WEB_ORIGIN}/login`);
      return;
    }

    const { state, nonce } = signSlackState(req.session.user.id);
    await redis.set(`slack:nonce:${nonce}`, '1', 'EX', 600);

    const redirectUri = encodeURIComponent(config.SLACK_CALLBACK_URL);
    const authorizeUrl = `https://slack.com/oauth/v2/authorize?client_id=${config.SLACK_CLIENT_ID}&scope=incoming-webhook&redirect_uri=${redirectUri}&state=${state}`;

    res.redirect(authorizeUrl);
  });

  app.get('/integrations/slack/callback', async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!state || typeof state !== 'string') {
      res.redirect(`${config.WEB_ORIGIN}/scheduled?slack=error`);
      return;
    }

    const verified = verifySlackState(state);
    if (!verified) {
      res.redirect(`${config.WEB_ORIGIN}/scheduled?slack=error`);
      return;
    }

    const nonceKey = `slack:nonce:${verified.nonce}`;
    const nonceValid = await redis.del(nonceKey);
    if (!nonceValid) {
      res.redirect(`${config.WEB_ORIGIN}/scheduled?slack=error`);
      return;
    }

    try {
      const resp = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.SLACK_CLIENT_ID,
          client_secret: config.SLACK_CLIENT_SECRET,
          code: String(code),
          redirect_uri: config.SLACK_CALLBACK_URL,
        }),
      });

      const data = (await resp.json()) as any;
      if (!data.ok || !data.incoming_webhook) {
        logger.error({ data }, 'Slack OAuth exchange failed');
        res.redirect(`${config.WEB_ORIGIN}/scheduled?slack=error`);
        return;
      }

      const encryptedWebhook = encryptToken(data.incoming_webhook.url);
      const encryptedToken = encryptToken(data.access_token);

      await prisma.slackConnection.upsert({
        where: { userId: verified.userId },
        update: {
          teamId: data.team.id,
          teamName: data.team.name,
          channel: data.incoming_webhook.channel,
          encryptedWebhookUrl: encryptedWebhook,
          encryptedAccessToken: encryptedToken,
          scope: data.scope,
          revokedAt: null,
        },
        create: {
          userId: verified.userId,
          teamId: data.team.id,
          teamName: data.team.name,
          channel: data.incoming_webhook.channel,
          encryptedWebhookUrl: encryptedWebhook,
          encryptedAccessToken: encryptedToken,
          scope: data.scope,
        },
      });

      res.redirect(`${config.WEB_ORIGIN}/scheduled?slack=connected`);
    } catch (err) {
      logger.error(err, 'Failed to complete Slack OAuth callback');
      res.redirect(`${config.WEB_ORIGIN}/scheduled?slack=error`);
    }
  });

  app.get('/api/integrations/slack', async (req: Request, res: Response) => {
    if (!req.session?.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      return;
    }

    const conn = await prisma.slackConnection.findUnique({
      where: { userId: req.session.user.id },
    });

    if (!conn) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: true,
      teamName: conn.teamName,
      channel: conn.channel,
      revoked: Boolean(conn.revokedAt),
    });
  });

  app.delete('/api/integrations/slack', async (req: Request, res: Response) => {
    if (!req.session?.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      return;
    }

    await prisma.slackConnection.deleteMany({
      where: { userId: req.session.user.id },
    });

    res.json({ success: true });
  });
}
