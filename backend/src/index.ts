import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config.js';
import { logger } from './config.js';
import { prisma } from './db.js';
import { redis } from './db.js';
import { emailQueue, reconcile } from './queue.js';
import { initElasticsearchIndex } from './search.js';
import { setupAuthRoutes, checkOrigin, requireAdmin, requireAuth } from './auth.js';
import { setupSlackRoutes } from './slack.js';
import { routes } from './routes.js';
import { startWorker } from './worker.js';

const app = express();

if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Pino logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

// JSON body parsing with 1MB limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CORS
app.use(
  cors({
    origin: [config.WEB_ORIGIN, config.API_ORIGIN],
    credentials: true,
  })
);

// Redis Sessions
const redisStore = new RedisStore({
  client: redis,
  prefix: 'sess:',
});

app.use(
  session({
    store: redisStore,
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Origin / CSRF check
app.use(checkOrigin);

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Bull Board Admin
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});
app.use('/admin/queues', requireAuth, requireAdmin, serverAdapter.getRouter());

// Auth & Slack Routes
setupAuthRoutes(app);
setupSlackRoutes(app);

// Application API routes
app.use(routes);

// Serve built frontend if in production and dist exists
if (config.NODE_ENV === 'production') {
  const distPath = path.resolve(process.cwd(), '../frontend/dist');
  const indexHtmlPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/integrations') ||
        req.path.startsWith('/admin') ||
        req.path.startsWith('/health')
      ) {
        return next();
      }
      res.sendFile(indexHtmlPath);
    });
  } else {
    // Frontend hosted separately (e.g. Vercel)
    app.get('/', (req, res) => {
      res.status(200).json({ status: 'ok', service: 'Outly API' });
    });
  }
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err, 'Unhandled request error');
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  });
});

// In-process worker if RUN_WORKER=true
let inProcessWorker: any = null;
if (config.RUN_WORKER) {
  logger.info('Starting in-process worker (RUN_WORKER=true)');
  inProcessWorker = startWorker();
}

// Server startup
const server = app.listen(config.PORT, async () => {
  logger.info(`API server running on port ${config.PORT}`);
  await initElasticsearchIndex();
  await reconcile();
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal. Closing gracefully...');
  server.close(async () => {
    logger.info('HTTP server closed');
    if (inProcessWorker) {
      await inProcessWorker.close();
      logger.info('Worker closed');
    }
    await emailQueue.close();
    await redis.quit();
    await prisma.$disconnect();
    logger.info('All connections cleanly shut down.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
