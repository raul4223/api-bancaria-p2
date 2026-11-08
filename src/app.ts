import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { apiRoutes } from './routes/index.js';
import { openApiDocument } from './docs/openapi.js';
import { errorMiddleware } from './middlewares/errorMiddleware.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';

// Responder disponibilidade e prontidão da conexão com o banco
const healthHandler = async (_req: Request, res: Response) => {
  if (env.nodeEnv === 'test') {
    res.status(200).json({ status: 'ok', database: 'skipped-in-test' });
    return;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
};

// Criar Express com segurança, limite de entrada, rotas e documentação
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.corsOrigin.split(',').map((origin) => origin.trim()), credentials: false }));
app.use(express.json({ limit: '100kb' }));
app.get('/health', healthHandler);
app.get('/openapi.json', (_req, res) => res.status(200).json(openApiDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use('/api/v1', apiRoutes);
app.use(errorMiddleware);
