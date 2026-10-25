import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from './config.js';
import { prisma, redis } from './db.js';
import { logger } from './config.js';

export const googleClient = new OAuth2Client(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  config.GOOGLE_CALLBACK_URL
);

export async function seedSendersForUser(userId: string, email: string) {
  const atIdx = email.indexOf('@');
  const local = atIdx > 0 ? email.slice(0, atIdx) : email;
  const domain = atIdx > 0 ? email.slice(atIdx + 1) : 'ong.local';

  const defaultEmails = [
    email,
    `${local}+sales@${domain}`,
    `${local}+support@${domain}`,
  ];

  for (const fromEmail of defaultEmails) {
    await prisma.sender.upsert({
      where: {
        userId_fromEmail: {
          userId,
          fromEmail,
        },
      },
      update: {},
      create: {
        userId,
        fromEmail,
        enabled: true,
      },
    });
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  const adminList = config.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!adminList.includes(req.session.user.email.toLowerCase())) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }
  next();
}

export function checkOrigin(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin || req.headers.referer;
    if (config.NODE_ENV === 'production' && origin) {
      try {
        const originUrl = new URL(origin).origin;
        if (originUrl !== config.WEB_ORIGIN && originUrl !== config.API_ORIGIN) {
          res.status(403).json({ error: { code: 'CSRF_REJECTED', message: 'Invalid origin' } });
          return;
        }
      } catch {
        res.status(403).json({ error: { code: 'CSRF_REJECTED', message: 'Malformed origin' } });
        return;
      }
    }
  }
  next();
}

export function setupAuthRoutes(app: any) {
  app.get('/auth/google', (req: Request, res: Response) => {
    // If not configured with real Google OAuth credentials in dev, mock login option for local dev
    if (!config.GOOGLE_CLIENT_ID || config.GOOGLE_CLIENT_ID === 'mock-google-client-id') {
      const mockSub = 'mock-google-sub-123';
      const mockEmail = 'dev.user@ong.local';
      const mockName = 'Dev User';

      prisma.user.upsert({
        where: { googleSubject: mockSub },
        update: { email: mockEmail, name: mockName },
        create: {
          googleSubject: mockSub,
          email: mockEmail,
          name: mockName,
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dev',
        },
      }).then(async (user) => {
        await seedSendersForUser(user.id, user.email);
        req.session.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        };
        req.session.save(() => {
          res.redirect(`${config.WEB_ORIGIN}/dashboard`);
        });
      }).catch((err) => {
        logger.error(err, 'Mock auth failure');
        res.status(500).send('Mock auth error');
      });
      return;
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const exp = Date.now() + 15 * 60 * 1000;
    const payload = JSON.stringify({ nonce, exp });
    const payloadBase64 = Buffer.from(payload).toString('base64url');
    const hmac = crypto.createHmac('sha256', config.SESSION_SECRET).update(payloadBase64).digest('base64url');
    const signedState = `${payloadBase64}.${hmac}`;

    (req.session as any).oauthState = signedState;

    const url = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state: signedState,
      prompt: 'consent',
    });

    req.session.save((err) => {
      if (err) logger.error(err, 'Failed to save session before Google redirect');
      res.redirect(url);
    });
  });

  app.get('/auth/google/callback', async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      const expectedState = (req.session as any)?.oauthState;

      // Validate state: if present, verify HMAC signature or session match
      if (state) {
        let valid = state === expectedState;
        if (!valid && typeof state === 'string') {
          try {
            const [payloadBase64, hmac] = state.split('.');
            const expectedHmac = crypto.createHmac('sha256', config.SESSION_SECRET).update(payloadBase64).digest('base64url');
            if (hmac === expectedHmac) {
              const data = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
              if (Date.now() <= data.exp) valid = true;
            }
          } catch {}
        }
        // In local development or cross-port testing, if code exists and ticket validates, permit sign-in
        if (!valid && config.NODE_ENV === 'production') {
          res.status(400).send('Invalid OAuth state');
          return;
        }
      }

      delete (req.session as any)?.oauthState;

      const { tokens } = await googleClient.getToken(code as string);
      googleClient.setCredentials(tokens);

      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        res.status(400).send('Invalid Google profile');
        return;
      }

      const user = await prisma.user.upsert({
        where: { googleSubject: payload.sub },
        update: {
          email: payload.email,
          name: payload.name || payload.email,
          avatarUrl: payload.picture,
        },
        create: {
          googleSubject: payload.sub,
          email: payload.email,
          name: payload.name || payload.email,
          avatarUrl: payload.picture,
        },
      });

      await seedSendersForUser(user.id, user.email);

      req.session.regenerate(async (err) => {
        if (err) {
          logger.error(err, 'Session regenerate error');
          res.redirect(`${config.WEB_ORIGIN}/login?error=session`);
          return;
        }

        req.session.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        };

        const authTicket = crypto.randomBytes(24).toString('hex');
        await redis.set(`auth_ticket:${authTicket}`, user.id, 'EX', 60);

        req.session.save(() => {
          res.redirect(`${config.WEB_ORIGIN}/dashboard?auth_ticket=${authTicket}`);
        });
      });
    } catch (err) {
      logger.error(err, 'Google callback error');
      res.redirect(`${config.WEB_ORIGIN}/login?error=oauth`);
    }
  });

  app.post('/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        logger.error(err, 'Logout session destroy error');
        res.status(500).json({ error: { code: 'LOGOUT_ERROR', message: 'Failed to logout' } });
        return;
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ success: true });
    });
  });
}
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
      avatarUrl?: string | null;
    };
    oauthState?: string;
  }
}
