import { prisma } from '../db.js';
import { enqueueEmailsBulk } from '../queue.js';
import { logger } from '../logger.js';
import crypto from 'node:crypto';

async function run() {
  logger.info('Starting 1,000 email load test...');

  let testUser = await prisma.user.findFirst();
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        googleSubject: 'loadtest-user-sub',
        email: 'loadtest@example.com',
        name: 'Load Tester',
      },
    });
  }

  let sender = await prisma.sender.findFirst({
    where: { userId: testUser.id },
  });
  if (!sender) {
    sender = await prisma.sender.create({
      data: {
        userId: testUser.id,
        fromEmail: 'loadtest@example.com',
      },
    });
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: testUser.id,
      senderId: sender.id,
      subject: 'Load test email',
      bodyHtml: '<p>Load test payload</p>',
      bodyText: 'Load test payload',
      startAt: new Date(Date.now() + 60000),
      delaySeconds: 1,
      hourlyLimit: 500,
      status: 'scheduled',
      idempotencyKey: `loadtest-${Date.now()}`,
      totalCount: 1000,
    },
  });

  const BATCH_SIZE = 100;
  const TOTAL = 1000;
  const now = Date.now();

  for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
    const chunk = Array.from({ length: BATCH_SIZE }).map((_, idx) => {
      const emailId = crypto.randomUUID();
      const scheduledAt = new Date(now + 60000 + (i + idx) * 1000);
      return {
        id: emailId,
        campaignId: campaign.id,
        userId: testUser.id,
        senderId: sender.id,
        recipientEmail: `recipient-${i + idx}@example.com`,
        subject: 'Load test',
        preview: 'Load test payload',
        scheduledAt,
        status: 'scheduled',
        bullJobId: `email_${emailId}`,
      };
    });

    await prisma.email.createMany({ data: chunk });
    await enqueueEmailsBulk(
      chunk.map((e) => ({
        emailId: e.id,
        scheduledAt: e.scheduledAt,
      }))
    );
    logger.info(`Enqueued batch ${i + BATCH_SIZE} / ${TOTAL}`);
  }

  logger.info('Load test finished successfully: 1,000 delayed jobs enqueued.');
  process.exit(0);
}

run().catch((err) => {
  logger.error(err, 'Load test failed');
  process.exit(1);
});
