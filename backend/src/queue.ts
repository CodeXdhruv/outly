import { Queue, DelayedError } from 'bullmq';
import { redis } from './db.js';
import { prisma } from './db.js';
import { logger } from './config.js';
import { bulkIndexEmails } from './search.js';

export const emailQueue = new Queue('emails', {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 200 },
  },
});

export async function enqueueEmail(emailId: string, scheduledAt: Date) {
  const now = Date.now();
  const delay = Math.max(0, scheduledAt.getTime() - now);
  const bullJobId = `email_${emailId}`;

  await emailQueue.add(
    'send',
    { emailId },
    {
      jobId: bullJobId,
      delay,
    }
  );
}

export async function enqueueEmailsBulk(items: Array<{ emailId: string; scheduledAt: Date }>) {
  const now = Date.now();
  const chunkSize = 500;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const jobs = chunk.map((item) => ({
      name: 'send',
      data: { emailId: item.emailId },
      opts: {
        jobId: `email_${item.emailId}`,
        delay: Math.max(0, item.scheduledAt.getTime() - now),
      },
    }));

    await emailQueue.addBulk(jobs);
  }
}

/**
 * Startup reconciliation
 * Run on API start and Worker start
 */
export async function reconcile() {
  logger.info('Starting reconciliation...');
  const now = new Date();

  try {
    // 1. Check scheduled emails in chunks of 500
    let cursor: string | undefined = undefined;
    let reconciledCount = 0;

    while (true) {
      const scheduledBatch: Array<{ id: string; scheduledAt: Date; bullJobId: string }> = await prisma.email.findMany({
        take: 500,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        where: { status: 'scheduled' },
        orderBy: { id: 'asc' },
        select: { id: true, scheduledAt: true, bullJobId: true },
      });

      if (scheduledBatch.length === 0) break;

      for (const email of scheduledBatch) {
        cursor = email.id;
        const job = await emailQueue.getJob(email.bullJobId);

        let needsEnqueue = false;
        if (!job) {
          needsEnqueue = true;
        } else {
          const state = await job.getState();
          if (state === 'completed' || state === 'failed') {
            await job.remove().catch(() => {});
            needsEnqueue = true;
          }
        }

        if (needsEnqueue) {
          const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
          await emailQueue.add(
            'send',
            { emailId: email.id },
            {
              jobId: email.bullJobId,
              delay,
            }
          );
          reconciledCount++;
        }
      }
    }

    if (reconciledCount > 0) {
      logger.info({ reconciledCount }, 'Reconciled missing scheduled jobs in queue');
    }

    // 2. Worker crashed mid-send (status='processing' and updatedAt < now - 5min)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const crashedProcessing = await prisma.email.findMany({
      where: {
        status: 'processing',
        updatedAt: { lt: fiveMinutesAgo },
      },
    });

    for (const email of crashedProcessing) {
      await prisma.email.update({
        where: { id: email.id },
        data: { status: 'scheduled' },
      });

      const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
      await emailQueue.add(
        'send',
        { emailId: email.id },
        {
          jobId: email.bullJobId,
          delay,
        }
      );
      logger.warn({ emailId: email.id }, 'Reset crashed processing email to scheduled');
    }

    // 3. Unsynced ES sweep (searchSyncedAt IS NULL OR < updatedAt, up to 1000)
    const unsyncedEmails = await prisma.email.findMany({
      take: 1000,
      where: {
        OR: [
          { searchSyncedAt: null },
          { searchSyncedAt: { lt: prisma.email.fields.updatedAt } }
        ]
      },
    });

    if (unsyncedEmails.length > 0) {
      await bulkIndexEmails(unsyncedEmails);
      logger.info({ count: unsyncedEmails.length }, 'Synced emails to Elasticsearch');
    }

    // 4. Clean up unclaimed attachments older than 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deletedAttachments = await prisma.attachment.deleteMany({
      where: {
        campaignId: null,
        createdAt: { lt: oneDayAgo },
      },
    });
    if (deletedAttachments.count > 0) {
      logger.info({ count: deletedAttachments.count }, 'Deleted old unclaimed attachments');
    }

    logger.info('Reconciliation completed successfully.');
  } catch (err) {
    logger.error(err, 'Error during reconciliation');
  }
}
