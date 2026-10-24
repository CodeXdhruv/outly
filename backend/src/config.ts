import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  API_ORIGIN: z.string().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ELASTICSEARCH_URL: z.string().optional().default(''),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:4000/auth/google/callback'),

  SESSION_SECRET: z.string().min(16).default('reachinbox-dev-session-secret-at-least-32-chars-long'),
  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_CALLBACK_URL: z.string().default('https://mock-tunnel.ngrok-free.app/integrations/slack/callback'),
  TOKEN_ENCRYPTION_KEY: z.string().default('T+PIm0Y/sPaSFdPgH33mMfeITS5ENvDdT3OH8gI7Oew='),

  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().default(''),
  ETHEREAL_PASS: z.string().default(''),

  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_DELAY_BETWEEN_SENDS_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(100),
  MAX_EMAILS_PER_HOUR_GLOBAL: z.coerce.number().default(200),
  RATE_LIMIT_TIMEZONE: z.literal('UTC').default('UTC'),
  ADMIN_EMAILS: z.string().default(''),

  MAX_RECIPIENTS: z.coerce.number().default(5000),
  MAX_UPLOAD_BYTES: z.coerce.number().default(2097152),
  RUN_WORKER: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

import pino from 'pino';

export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  transport: config.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true },
  } : undefined,
});
