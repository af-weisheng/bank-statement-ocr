import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { authRouter }    from './routes/auth';
import { processRouter } from './routes/process';
import { adminRouter }   from './routes/admin';
import { errorHandler }  from './middleware/errorHandler';
import { checkConnection } from './database/connection';

/**
 * Creates and configures the Express application.
 * Exported separately from the server entry-point so integration tests can
 * obtain a clean app instance without starting a real TCP listener.
 */
export function createApp() {
  const app = express();

  app.use(helmet());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',').map(o => o.trim()).filter(Boolean);

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error(`CORS: origin '${origin}' is not allowed.`));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Suppress noisy request logging in test runs.
  if (process.env.NODE_ENV !== 'test') {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  // Global rate limiter — disabled in test to keep tests fast and deterministic.
  if (process.env.NODE_ENV !== 'test') {
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req: Request, res: Response) =>
        res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' }),
    });
    app.use(globalLimiter);
  }

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 1000 : 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) =>
      res.status(429).json({ success: false, error: 'Too many authentication attempts.' }),
  });

  app.get('/api/health', async (_req: Request, res: Response) => {
    const dbOk = await checkConnection();
    res.status(dbOk ? 200 : 503).json({
      status:    dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database:  dbOk ? 'connected' : 'unreachable',
    });
  });

  app.use('/api/auth',    authLimiter, authRouter);
  app.use('/api/process', processRouter);
  app.use('/api/admin',   adminRouter);

  app.use((_req: Request, res: Response) =>
    res.status(404).json({ success: false, error: 'Route not found.' }));

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
    errorHandler(err as Error, req, res, next));

  return app;
}
