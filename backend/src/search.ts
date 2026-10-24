import { Client } from '@elastic/elasticsearch';
import { config } from './config.js';
import { logger } from './config.js';
import { prisma } from './db.js';

export let esClient: Client | null = null;

if (config.ELASTICSEARCH_URL) {
  try {
    esClient = new Client({ node: config.ELASTICSEARCH_URL });
    logger.info({ node: config.ELASTICSEARCH_URL }, 'Elasticsearch client configured');
  } catch (err) {
    logger.error(err, 'Failed to initialize Elasticsearch client');
  }
} else {
  logger.info('ELASTICSEARCH_URL not configured. Search queries will fall back to PostgreSQL.');
}

const EMAILS_INDEX = 'emails';

export async function initElasticsearchIndex() {
  if (!esClient) return;

  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
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
      logger.info('Created Elasticsearch "emails" index with mappings');
    }
  } catch (err) {
    logger.error(err, 'Error initializing Elasticsearch index');
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
  if (!esClient) return;

  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
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

    await prisma.email.update({
      where: { id: email.id },
      data: { searchSyncedAt: new Date() },
    });
  } catch (err) {
    logger.warn({ err, emailId: email.id }, 'Failed to index email in Elasticsearch');
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
  if (!esClient || emails.length === 0) return;

  try {
    const operations = emails.flatMap((doc) => [
      { index: { _index: EMAILS_INDEX, _id: doc.id } },
      {
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
      },
    ]);

    const bulkResponse = await esClient.bulk({ refresh: true, operations });
    if (bulkResponse.errors) {
      logger.warn('Some errors occurred during ES bulk indexing');
    }

    const ids = emails.map((e) => e.id);
    await prisma.email.updateMany({
      where: { id: { in: ids } },
      data: { searchSyncedAt: new Date() },
    });
  } catch (err) {
    logger.warn(err, 'Elasticsearch bulk index failure');
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
  if (!esClient) return null;

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

    const response: any = await esClient.search({
      index: EMAILS_INDEX,
      ...searchBody,
    });

    const hits = response.hits.hits;
    const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0;
    const emailIds = hits.map((h: any) => h._id as string);

    return { emailIds, total };
  } catch (err) {
    logger.warn(err, 'Elasticsearch search error; falling back to PostgreSQL');
    return null;
  }
}
