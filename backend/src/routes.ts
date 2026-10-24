import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma, redis } from './db.js';
import { requireAuth } from './auth.js';
import { parseRecipients, sanitizeBody } from './email.js';
import { enqueueEmailsBulk } from './queue.js';
import { searchEmails, bulkIndexEmails } from './search.js';
import { config } from './config.js';
import { logger } from './config.js';

export const routes = Router();

const upload = multer({
  limits: {
    fileSize: config.MAX_UPLOAD_BYTES,
  },
});

// Allowed attachment mime types
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
]);

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'csv']);

// 1. Current user
routes.get('/api/me', async (req: Request, res: Response) => {
  const ticket = req.query.auth_ticket as string || req.headers['x-auth-ticket'] as string;
  if (ticket && !req.session?.user) {
    try {
      const userId = await redis.get(`auth_ticket:${ticket}`);
      if (userId) {
        await redis.del(`auth_ticket:${ticket}`);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          req.session.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          };
          await new Promise<void>((resolve) => req.session.save(() => resolve()));
        }
      }
    } catch (e) {
      logger.error(e, 'Failed to redeem auth ticket');
    }
  }

  if (!req.session?.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
    return;
  }
  const adminList = config.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = adminList.includes(req.session.user.email.toLowerCase());

  res.json({
    id: req.session.user.id,
    email: req.session.user.email,
    name: req.session.user.name,
    avatarUrl: req.session.user.avatarUrl,
    isAdmin,
  });
});

// 2. Senders
routes.get('/api/senders', requireAuth, async (req: Request, res: Response) => {
  const senders = await prisma.sender.findMany({
    where: { userId: req.session.user!.id, enabled: true },
    select: { id: true, fromEmail: true },
  });
  res.json(senders);
});

// 3. Leads preview
routes.post('/api/leads/preview', requireAuth, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: { code: 'MISSING_FILE', message: 'No file uploaded' } });
    return;
  }

  const filename = req.file.originalname;
  const isCsv = filename.toLowerCase().endsWith('.csv');
  const isTxt = filename.toLowerCase().endsWith('.txt');

  if (!isCsv && !isTxt) {
    res.status(400).json({ error: { code: 'INVALID_FORMAT', message: 'Only CSV and TXT files allowed' } });
    return;
  }

  const content = req.file.buffer.toString('utf8');
  const parsed = parseRecipients(content, isCsv);

  const samples = [
    ...parsed.invalid.slice(0, 5).map((inv) => ({ row: inv.row, value: inv.value, reason: inv.reason })),
    ...parsed.duplicates.slice(0, 5).map((dup) => ({ row: dup.row, value: dup.value, reason: 'Duplicate' })),
  ].slice(0, 5);

  res.json({
    filename,
    emails: parsed.emails,
    valid: parsed.valid.length,
    invalid: parsed.invalid.length,
    duplicates: parsed.duplicates.length,
    samples,
  });
});

// 4. Attachments upload
routes.post('/api/attachments', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: { code: 'MISSING_FILE', message: 'No file uploaded' } });
    return;
  }

  const ext = req.file.originalname.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_MIME_TYPES.has(req.file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    res.status(400).json({
      error: { code: 'INVALID_ATTACHMENT_TYPE', message: 'File type not allowed' },
    });
    return;
  }

  const attachment = await prisma.attachment.create({
    data: {
      userId: req.session.user!.id,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
    },
  });

  res.json({
    id: attachment.id,
    filename: attachment.filename,
    size: attachment.size,
    mimeType: attachment.mimeType,
  });
});

// 5. Get attachment
routes.get('/api/attachments/:id', requireAuth, async (req: Request, res: Response) => {
  const attachment = await prisma.attachment.findFirst({
    where: {
      id: req.params.id,
      userId: req.session.user!.id,
    },
  });

  if (!attachment) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attachment not found' } });
    return;
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', attachment.mimeType);

  const isImage = attachment.mimeType.startsWith('image/');
  if (!isImage) {
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
  }

  res.send(attachment.data);
});

// 6. Create campaign
const createCampaignSchema = z.object({
  senderId: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1).max(config.MAX_RECIPIENTS),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1).max(50 * 1024),
  startAt: z.string().datetime(),
  delaySeconds: z.number().int().min(0).max(3600),
  hourlyLimit: z.number().int().min(1).max(1000),
  attachmentIds: z.array(z.string().uuid()).max(3).optional().default([]),
});

routes.post('/api/campaigns', requireAuth, async (req: Request, res: Response) => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  if (!idempotencyKey) {
    res.status(400).json({ error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required' } });
    return;
  }

  const userId = req.session.user!.id;

  // Check existing campaign for idempotent retry
  const existingCampaign = await prisma.campaign.findUnique({
    where: {
      userId_idempotencyKey: {
        userId,
        idempotencyKey,
      },
    },
  });

  if (existingCampaign) {
    res.status(200).json({
      campaignId: existingCampaign.id,
      accepted: existingCampaign.totalCount,
      invalid: 0,
      duplicates: 0,
      status: existingCampaign.status,
    });
    return;
  }

  const parseResult = createCampaignSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0]?.message || 'Invalid input' },
    });
    return;
  }

  const data = parseResult.data;

  // Validate sender ownership
  const sender = await prisma.sender.findFirst({
    where: { id: data.senderId, userId },
  });
  if (!sender) {
    res.status(400).json({ error: { code: 'INVALID_SENDER', message: 'Sender not found' } });
    return;
  }

  // Validate attachment ownership
  if (data.attachmentIds.length > 0) {
    const userAttachments = await prisma.attachment.findMany({
      where: {
        id: { in: data.attachmentIds },
        userId,
        campaignId: null,
      },
    });

    if (userAttachments.length !== data.attachmentIds.length) {
      res.status(400).json({ error: { code: 'INVALID_ATTACHMENTS', message: 'One or more attachments are invalid or already claimed' } });
      return;
    }
  }

  // Deduplicate and sanitize recipients
  const uniqueRecipients = Array.from(new Set(data.recipients.map((r) => r.trim().toLowerCase())));
  const duplicateCount = data.recipients.length - uniqueRecipients.length;

  const { bodyHtml, bodyText, preview } = sanitizeBody(data.bodyHtml);

  // Scheduling calculation: clamp past startAt to now
  const parsedStartAt = new Date(data.startAt);
  const now = new Date();
  const baseStartAt = parsedStartAt < now ? now : parsedStartAt;

  // Transaction: Create Campaign, Emails, and claim Attachments
  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        userId,
        senderId: data.senderId,
        subject: data.subject,
        bodyHtml,
        bodyText,
        startAt: baseStartAt,
        delaySeconds: data.delaySeconds,
        hourlyLimit: data.hourlyLimit,
        status: 'scheduled',
        idempotencyKey,
        totalCount: uniqueRecipients.length,
      },
    });

    if (data.attachmentIds.length > 0) {
      await tx.attachment.updateMany({
        where: { id: { in: data.attachmentIds } },
        data: { campaignId: campaign.id },
      });
    }

    const emailRows = uniqueRecipients.map((recipientEmail, i) => {
      const scheduledAt = new Date(baseStartAt.getTime() + i * data.delaySeconds * 1000);
      const emailId = crypto.randomUUID();
      return {
        id: emailId,
        campaignId: campaign.id,
        userId,
        senderId: data.senderId,
        recipientEmail,
        subject: data.subject,
        preview,
        scheduledAt,
        status: 'scheduled',
        bullJobId: `email_${emailId}`,
      };
    });

    await tx.email.createMany({
      data: emailRows,
    });

    return { campaign, emailRows };
  });

  // Enqueue in BullMQ
  await enqueueEmailsBulk(
    result.emailRows.map((e) => ({
      emailId: e.id,
      scheduledAt: e.scheduledAt,
    }))
  );

  // Best-effort Elasticsearch indexing
  bulkIndexEmails(
    result.emailRows.map((e) => ({
      ...e,
      sentAt: null,
      createdAt: new Date(),
    }))
  ).catch((e) => logger.warn(e, 'Async ES index error'));

  res.status(201).json({
    campaignId: result.campaign.id,
    accepted: uniqueRecipients.length,
    invalid: 0,
    duplicates: duplicateCount,
    status: result.campaign.status,
  });
});

// 7. Get Emails List
routes.get('/api/emails', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const statusParam = req.query.status as string; // 'scheduled' | 'sent'
  const search = (req.query.search as string)?.trim();
  const senderId = req.query.senderId as string;
  const starred = req.query.starred === 'true';
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip = (page - 1) * limit;

  const statusList =
    statusParam === 'sent'
      ? ['sent', 'failed']
      : ['scheduled', 'processing'];

  let emailIds: string[] | null = null;
  let esTotal: number | null = null;

  // Search via Elasticsearch if search is present and not filtering by starred
  if (search && !starred) {
    const esRes = await searchEmails({
      userId,
      query: search,
      status: statusList,
      senderId,
      page,
      limit,
    });

    if (esRes) {
      emailIds = esRes.emailIds;
      esTotal = esRes.total;
    }
  }

  if (emailIds !== null) {
    // Hydrate in original ES order
    const emails = await prisma.email.findMany({
      where: { id: { in: emailIds } },
      include: { sender: true },
    });

    const emailMap = new Map(emails.map((e) => [e.id, e]));
    const items = emailIds
      .map((id) => emailMap.get(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .map((e) => ({
        id: e.id,
        recipientEmail: e.recipientEmail,
        subject: e.subject,
        preview: e.preview,
        scheduledAt: e.scheduledAt.toISOString(),
        sentAt: e.sentAt ? e.sentAt.toISOString() : null,
        status: e.status,
        deferred: e.status === 'scheduled' && e.deferredCount > 0,
        starred: e.starred,
        senderEmail: e.sender.fromEmail,
      }));

    res.json({
      items,
      page,
      limit,
      total: esTotal || items.length,
    });
    return;
  }

  // Postgres Query Fallback
  const where: any = {
    userId,
    status: { in: statusList },
  };

  if (starred) {
    where.starred = true;
  }

  if (senderId) {
    where.senderId = senderId;
  }

  if (search) {
    where.OR = [
      { recipientEmail: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { preview: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy = statusParam === 'sent' ? { sentAt: 'desc' as const } : { scheduledAt: 'asc' as const };

  const [total, rows] = await Promise.all([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      include: { sender: true },
      skip,
      take: limit,
      orderBy,
    }),
  ]);

  const items = rows.map((e) => ({
    id: e.id,
    recipientEmail: e.recipientEmail,
    subject: e.subject,
    preview: e.preview,
    scheduledAt: e.scheduledAt.toISOString(),
    sentAt: e.sentAt ? e.sentAt.toISOString() : null,
    status: e.status,
    deferred: e.status === 'scheduled' && e.deferredCount > 0,
    starred: e.starred,
    senderEmail: e.sender.fromEmail,
  }));

  res.json({
    items,
    page,
    limit,
    total,
  });
});

// 8. Email counts for sidebar
routes.get('/api/emails/counts', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const cacheKey = `counts:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }
  } catch {}

  const [scheduled, sent] = await Promise.all([
    prisma.email.count({
      where: {
        userId,
        status: { in: ['scheduled', 'processing'] },
      },
    }),
    prisma.email.count({
      where: {
        userId,
        status: { in: ['sent', 'failed'] },
      },
    }),
  ]);

  const counts = { scheduled, sent };
  try {
    await redis.set(cacheKey, JSON.stringify(counts), 'EX', 5);
  } catch {}

  res.json(counts);
});

// 9. Email Detail
routes.get('/api/emails/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const email = await prisma.email.findFirst({
    where: { id: req.params.id, userId },
    include: {
      campaign: {
        include: {
          attachments: {
            select: { id: true, filename: true, size: true, mimeType: true },
          },
        },
      },
      sender: true,
    },
  });

  if (!email) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Email not found' } });
    return;
  }

  res.json({
    id: email.id,
    recipientEmail: email.recipientEmail,
    subject: email.subject,
    preview: email.preview,
    scheduledAt: email.scheduledAt.toISOString(),
    sentAt: email.sentAt ? email.sentAt.toISOString() : null,
    status: email.status,
    deferred: email.status === 'scheduled' && email.deferredCount > 0,
    starred: email.starred,
    senderEmail: email.sender.fromEmail,
    bodyHtml: email.campaign.bodyHtml,
    attachments: email.campaign.attachments,
    attemptCount: email.attemptCount,
    errorMessage: email.lastErrorMessage,
  });
});

// 10. Star toggle
routes.patch('/api/emails/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const { starred } = req.body;

  if (typeof starred !== 'boolean') {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'starred must be boolean' } });
    return;
  }

  const email = await prisma.email.findFirst({
    where: { id: req.params.id, userId },
  });

  if (!email) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Email not found' } });
    return;
  }

  const updated = await prisma.email.update({
    where: { id: email.id },
    data: { starred },
  });

  res.json({ id: updated.id, starred: updated.starred });
});
