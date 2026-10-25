import { Client } from '@elastic/elasticsearch';
import { config } from './config.js';
import { logger } from './config.js';
import { prisma } from './db.js';

interface EsSearchConfig {
  baseUrl: string;
  authHeader?: string;
}

let esConfig: EsSearchConfig | null = null;

if (config.ELASTICSEARCH_URL) {
  try {
    const parsed = new URL(config.ELASTICSEARCH_URL.trim());
    const authHeader =
      parsed.username || parsed.password
        ? 'Basic ' + Buffer.from(`${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`).toString('base64')
        : undefined;

    esConfig = {
      baseUrl: `${parsed.protocol}//${parsed.host}`,
      authHeader,
    };
    logger.info({ node: esConfig.baseUrl }, 'Search client configured');
  } catch (err) {
    logger.error(err, 'Failed to initialize search client config');
  }
} else {
  logger.info('ELASTICSEARCH_URL not configured. Search queries will fall back to PostgreSQL.');
}

const EMAILS_INDEX = 'emails';

async function esRequest(path: string, options: { method?: string; body?: any; isNdjson?: boolean } = {}) {
  if (!esConfig) throw new Error('Search client not configured');

  const headers: Record<string, string> = {
    'Content-Type': options.isNdjson ? 'application/x-ndjson' : 'application/json',
    Accept: 'application/json',
  };

  if (esConfig.authHeader) {
    headers['Authorization'] = esConfig.authHeader;
  }

  const res = await fetch(`${esConfig.baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  });

  return res;
}

export async function initElasticsearchIndex() {
  if (!esConfig) return;

  try {
    const headRes = await esRequest(`/${EMAILS_INDEX}`, { method: 'HEAD' });
    if (headRes.status === 404) {
      const createRes = await esRequest(`/${EMAILS_INDEX}`, {
        method: 'PUT',
        body: {
          mappings: {
            properties: {
              emailId: { type: 'keyword' },
              userId: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              recipientEmail: {
                type: 'text',
                fields: { keyword: { type: 'keyword' } },
              },
              subject: {
                type: 'text',
                fields: { keyword: { type: 'keyword' } },
              },
              preview: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });

      if (createRes.ok) {
        logger.info('Created search "emails" index with mappings');
      } else {
        const errorText = await createRes.text();
        logger.error({ errorText }, 'Error initializing search index');
      }
    } else if (headRes.ok) {
      logger.info('Search "emails" index verified');
    }
  } catch (err) {
    logger.error(err, 'Error initializing search index');
  }
}

export async function indexEmail(email: {
  id: string;
  userId: string;
  campaignId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  preview: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  createdAt: Date;
}) {
  if (!esConfig) return;

  try {
    const res = await esRequest(`/${EMAILS_INDEX}/_doc/${encodeURIComponent(email.id)}`, {
      method: 'PUT',
      body: {
        emailId: email.id,
        userId: email.userId,
        campaignId: email.campaignId,
        senderId: email.senderId,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        preview: email.preview,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt ? email.sentAt.toISOString() : null,
        createdAt: email.createdAt.toISOString(),
      },
    });

    if (res.ok) {
      await prisma.email.update({
        where: { id: email.id },
        data: { searchSyncedAt: new Date() },
      });
    } else {
      const errText = await res.text();
      logger.warn({ errText, emailId: email.id }, 'Failed to index email in search backend');
    }
  } catch (err) {
    logger.warn({ err, emailId: email.id }, 'Failed to index email in search backend');
  }
}

export async function bulkIndexEmails(
  emails: Array<{
    id: string;
    userId: string;
    campaignId: string;
    senderId: string;
    recipientEmail: string;
    subject: string;
    preview: string;
    status: string;
    scheduledAt: Date;
    sentAt?: Date | null;
    createdAt: Date;
  }>
) {
  if (!esConfig || emails.length === 0) return;

  try {
    const lines: string[] = [];
    for (const doc of emails) {
      lines.push(JSON.stringify({ index: { _index: EMAILS_INDEX, _id: doc.id } }));
      lines.push(
        JSON.stringify({
          emailId: doc.id,
          userId: doc.userId,
          campaignId: doc.campaignId,
          senderId: doc.senderId,
          recipientEmail: doc.recipientEmail,
          subject: doc.subject,
          preview: doc.preview,
          status: doc.status,
          scheduledAt: doc.scheduledAt.toISOString(),
          sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
          createdAt: doc.createdAt.toISOString(),
        })
      );
    }
    const ndjsonBody = lines.join('\n') + '\n';

    const res = await esRequest('/_bulk?refresh=true', {
      method: 'POST',
      body: ndjsonBody,
      isNdjson: true,
    });

    if (res.ok) {
      const json: any = await res.json();
      if (json.errors) {
        logger.warn('Some errors occurred during search bulk indexing');
      }

      const ids = emails.map((e) => e.id);
      await prisma.email.updateMany({
        where: { id: { in: ids } },
        data: { searchSyncedAt: new Date() },
      });
    } else {
      const errText = await res.text();
      logger.warn({ errText }, 'Search bulk index HTTP failure');
    }
  } catch (err) {
    logger.warn(err, 'Search bulk index failure');
  }
}

export async function searchEmails(params: {
  userId: string;
  query: string;
  status?: string[];
  senderId?: string;
  page?: number;
  limit?: number;
}): Promise<{ emailIds: string[]; total: number } | null> {
  if (!esConfig) return null;

  const { userId, query, status, senderId, page = 1, limit = 20 } = params;
  const from = (page - 1) * limit;

  try {
    const mustFilters: any[] = [{ term: { userId } }];

    if (status && status.length > 0) {
      mustFilters.push({ terms: { status } });
    }

    if (senderId) {
      mustFilters.push({ term: { senderId } });
    }

    const searchBody: any = {
      from,
      size: limit,
      query: {
        bool: {
          filter: mustFilters,
          must: [
            {
              multi_match: {
                query,
                fields: ['recipientEmail^3', 'subject^2', 'preview'],
                type: 'phrase_prefix',
              },
            },
          ],
        },
      },
      sort: [{ scheduledAt: { order: 'desc' } }],
    };

    const res = await esRequest(`/${EMAILS_INDEX}/_search`, {
      method: 'POST',
      body: searchBody,
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.warn({ errText }, 'Search backend error; falling back to PostgreSQL');
      return null;
    }

    const response: any = await res.json();
    const hits = response.hits?.hits || [];
    const total =
      typeof response.hits?.total === 'number'
        ? response.hits.total
        : response.hits?.total?.value || 0;
    const emailIds = hits.map((h: any) => h._id as string);

    return { emailIds, total };
  } catch (err) {
    logger.warn(err, 'Search error; falling back to PostgreSQL');
    return null;
  }
}
