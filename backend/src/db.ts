import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { config, logger } from './config.js';

export const prisma = new PrismaClient();

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  logger.error(err, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});
