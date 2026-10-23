import { Worker, Job, DelayedError } from 'bullmq';
import { redis } from './redis.js';
import { prisma } from './db.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { reserveSendSlot, releaseReservation } from './rateLimit.js';
import { sendEmailViaSmtp, classifySmtpError } from './email.js';
import { notifyLimitHit } from './slack.js';
import { indexEmail } from './search.js';
import { reconcile } from './queue.js';

export async function processEmailJob(job: Job<{ emailId: string }>) {
  const { emailId } = job.data;
  const now = Date.now();

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: {
      campaign: true,
      sender: true,
    },
  });

  if (!email || email.status !== 'scheduled') {
    // Already processed, sent, or cancelled
    return;
  }

  // Rate-limit check & reservation
  const spacingMs = Math.max(email.campaign.delaySeconds * 1000, config.MIN_DELAY_BETWEEN_SENDS_MS);
  const hourlyLimit = email.campaign.hourlyLimit;

  const reservation = await reserveSendSlot(email.senderId, hourlyLimit, spacingMs, now);

  if (!reservation.ok) {
    // Rate limit hit or spacing needed -> defer
    const jitter = Math.floor(Math.random() * (spacingMs * config.WORKER_CONCURRENCY));
    const nextRetryAt = new Date(reservation.retryAt + jitter);

    await prisma.email.update({
      where: { id: email.id },
      data: {
        scheduledAt: nextRetryAt,
        deferredCount: { increment: 1 },
      },
    });

    if (reservation.reason === 'sender_cap' || reservation.reason === 'global_cap') {
      notifyLimitHit({
        senderId: email.senderId,
        fromEmail: email.sender.fromEmail,
        limit: hourlyLimit,
        retryAt: reservation.retryAt,
      }).catch((e) => logger.error(e, 'Slack alert trigger error'));
    }

    const delay = Math.max(0, nextRetryAt.getTime() - Date.now());
    await job.moveToDelayed(Date.now() + delay, job.token);
    throw new DelayedError();
  }

  // Attempt conditional claim
  const claimed = await prisma.$executeRaw`
    UPDATE "Email"
    SET status = 'processing', "attemptCount" = "attemptCount" + 1, "updatedAt" = NOW()
    WHERE id = ${email.id} AND status = 'scheduled'
  `;

  if (claimed === 0) {
    // Another worker or process claimed it
    return;
  }

  try {
    const info = await sendEmailViaSmtp({
      emailId: email.id,
      fromEmail: email.sender.fromEmail,
      recipientEmail: email.recipientEmail,
      subject: email.subject,
      bodyHtml: email.campaign.bodyHtml,
      bodyText: email.campaign.bodyText,
      campaignId: email.campaignId,
    });

    const sentAt = new Date();
    const updated = await prisma.email.update({
      where: { id: email.id },
      data: {
        status: 'sent',
        sentAt,
        providerMessageId: info.messageId || null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    // Check if campaign is completed
    const pendingCount = await prisma.email.count({
      where: {
        campaignId: email.campaignId,
        status: { in: ['scheduled', 'processing'] },
      },
    });
    if (pendingCount === 0) {
      await prisma.campaign.update({
        where: { id: email.campaignId },
        data: { status: 'completed' },
      });
    }

    indexEmail(updated).catch(() => {});
  } catch (error: any) {
    const classification = classifySmtpError(error);
    logger.warn({ emailId, classification }, 'SMTP send failed');

    // Safe release counter since send didn't succeed
    await releaseReservation(email.senderId, now);

    const maxAttempts = 3;
    const currentAttempt = email.attemptCount + 1;

    if (classification.type === 'transient' && currentAttempt < maxAttempts) {
      // Backoff: 30s, 2m, 10m
      const backoffSec = currentAttempt === 1 ? 30 : currentAttempt === 2 ? 120 : 600;
      const nextAttemptTime = new Date(Date.now() + backoffSec * 1000);

      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'scheduled',
          scheduledAt: nextAttemptTime,
          lastErrorCode: classification.code || 'TRANSIENT_ERROR',
          lastErrorMessage: classification.message,
        },
      });

      const delay = Math.max(0, nextAttemptTime.getTime() - Date.now());
      await job.moveToDelayed(Date.now() + delay, job.token);
      throw new DelayedError();
    } else {
      // Permanent failure or max attempts reached
      const failed = await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'failed',
          lastErrorCode: classification.code || 'PERMANENT_ERROR',
          lastErrorMessage: classification.message,
        },
      });

      indexEmail(failed).catch(() => {});
    }
  }
}

export function startWorker() {
  const worker = new Worker('emails', processEmailJob, {
    connection: redis,
    concurrency: config.WORKER_CONCURRENCY,
  });

  worker.on('ready', () => {
    logger.info(`BullMQ Worker running with concurrency ${config.WORKER_CONCURRENCY}`);
    reconcile();
  });

  worker.on('error', (err) => {
    logger.error(err, 'BullMQ Worker error');
  });

  return worker;
}

if (process.argv[1]?.endsWith('worker.ts') || process.argv[1]?.endsWith('worker.js')) {
  const worker = startWorker();

  const shutdown = async () => {
    logger.info('Shutting down worker gracefully...');
    await worker.close();
    await redis.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
