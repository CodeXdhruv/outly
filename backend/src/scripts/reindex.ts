import { prisma } from '../db.js';
import { bulkIndexEmails, initElasticsearchIndex } from '../search.js';
import { logger } from '../logger.js';

async function run() {
  logger.info('Starting Elasticsearch reindex script...');
  await initElasticsearchIndex();

  let take = 500;
  let skip = 0;
  let total = 0;

  while (true) {
    const emails = await prisma.email.findMany({
      take,
      skip,
      orderBy: { id: 'asc' },
    });

    if (emails.length === 0) break;

    await bulkIndexEmails(emails);
    total += emails.length;
    skip += take;
    logger.info(`Reindexed ${total} emails so far...`);
  }

  logger.info(`Elasticsearch reindex complete. Total indexed: ${total}`);
  process.exit(0);
}

run().catch((err) => {
  logger.error(err, 'Elasticsearch reindex failed');
  process.exit(1);
});
