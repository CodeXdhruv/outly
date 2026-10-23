import nodemailer from 'nodemailer';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { config } from './config.js';
import { prisma } from './db.js';
import { logger } from './logger.js';

export interface RecipientParseResult {
  valid: string[];
  invalid: Array<{ row: number; value: string; reason: string }>;
  duplicates: Array<{ row: number; value: string }>;
  emails: string[];
}

const emailSchema = z.string().email();

export function parseRecipients(fileContent: string, isCsv: boolean): RecipientParseResult {
  const lines = fileContent.split(/\r?\n/);
  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: Array<{ row: number; value: string; reason: string }> = [];
  const duplicates: Array<{ row: number; value: string }> = [];

  let emailColIdx = -1;
  let startLine = 0;

  if (isCsv && lines.length > 0) {
    const firstLineCols = lines[0].split(',').map((c) => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    emailColIdx = firstLineCols.findIndex((col) => col === 'email');
    if (emailColIdx !== -1) {
      startLine = 1; // Header row
    } else {
      // Fallback: check first column
      emailColIdx = 0;
      startLine = 0;
    }
  }

  for (let i = startLine; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('#')) continue;

    let candidate = rawLine;
    if (isCsv) {
      const parts = rawLine.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      candidate = parts[emailColIdx >= 0 ? emailColIdx : 0] || '';
    }

    const email = candidate.trim().toLowerCase();
    if (!email) continue;

    const validCheck = emailSchema.safeParse(email);
    if (!validCheck.success) {
      invalid.push({ row: i + 1, value: candidate, reason: 'Invalid email format' });
      continue;
    }

    if (seen.has(email)) {
      duplicates.push({ row: i + 1, value: email });
    } else {
      seen.add(email);
      emails.push(email);
    }
  }

  return {
    valid: emails,
    emails,
    invalid,
    duplicates,
  };
}

export function sanitizeBody(html: string): { bodyHtml: string; bodyText: string; preview: string } {
  const cleanHtml = sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3',
      'ul', 'ol', 'li', 'blockquote', 'a', 'span'
    ],
    allowedAttributes: {
      a: ['href'],
      p: ['style'],
      span: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      blockquote: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedStyles: {
      '*': {
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
  });

  const spacedHtml = cleanHtml.replace(/></g, '> <');
  const bodyText = sanitizeHtml(spacedHtml, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, ' ')
    .trim();

  const preview = bodyText.slice(0, 140);

  return { bodyHtml: cleanHtml, bodyText, preview };
}

// Nodemailer transport singleton
let transporter: nodemailer.Transporter | null = null;

export async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  let host = config.ETHEREAL_HOST;
  let port = config.ETHEREAL_PORT;
  let user = config.ETHEREAL_USER;
  let pass = config.ETHEREAL_PASS;

  // Auto-generate test account if credentials not set in dev
  if (!user || !pass) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      host = testAccount.smtp.host;
      port = testAccount.smtp.port;
      user = testAccount.user;
      pass = testAccount.pass;
      logger.info({ user }, 'Created Ethereal test account');
    } catch (err) {
      logger.error(err, 'Could not create ethereal test account');
    }
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    pool: true,
    maxConnections: config.WORKER_CONCURRENCY,
    auth: user && pass ? { user, pass } : undefined,
  });

  return transporter;
}

export type ErrorClassification = 'transient' | 'permanent';

export function classifySmtpError(error: any): { type: ErrorClassification; message: string; code?: string } {
  const code = error.code || String(error.responseCode || '');
  const message = (error.message || 'Unknown SMTP error').slice(0, 200);

  if (
    code.startsWith('5') ||
    code === 'EENVELOPE' ||
    message.includes('No recipients defined') ||
    message.includes('Invalid login')
  ) {
    return { type: 'permanent', message, code };
  }

  if (
    code === 'ECONNECTION' ||
    code === 'ETIMEDOUT' ||
    code === 'ESOCKET' ||
    ['421', '450', '451', '452'].includes(code)
  ) {
    return { type: 'transient', message, code };
  }

  return { type: 'transient', message, code };
}

// Worker attachment in-memory cache: campaignId -> { attachments, expires }
interface CachedAttachments {
  attachments: Array<{ filename: string; content: Buffer; contentType: string }>;
  expires: number;
}
const attachmentCache = new Map<string, CachedAttachments>();

export async function getCampaignAttachments(campaignId: string) {
  const cached = attachmentCache.get(campaignId);
  if (cached && cached.expires > Date.now()) {
    return cached.attachments;
  }

  const rows = await prisma.attachment.findMany({
    where: { campaignId },
  });

  const attachments = rows.map((r) => ({
    filename: r.filename,
    content: Buffer.from(r.data),
    contentType: r.mimeType,
  }));

  if (attachmentCache.size > 20) {
    const oldestKey = attachmentCache.keys().next().value;
    if (oldestKey) attachmentCache.delete(oldestKey);
  }

  attachmentCache.set(campaignId, {
    attachments,
    expires: Date.now() + 5 * 60 * 1000,
  });

  return attachments;
}

export async function sendEmailViaSmtp(params: {
  emailId: string;
  fromEmail: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  campaignId: string;
}) {
  const { emailId, fromEmail, recipientEmail, subject, bodyHtml, bodyText, campaignId } = params;
  const transport = await getTransporter();
  const attachments = await getCampaignAttachments(campaignId);

  const info = await transport.sendMail({
    from: fromEmail,
    to: recipientEmail,
    subject,
    html: bodyHtml,
    text: bodyText,
    headers: {
      'Message-ID': `<email-${emailId}@ong.local>`,
    },
    attachments,
  });

  return info;
}
