import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Criar limites por operação sensível e desligá-los nos testes
const createLimiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.nodeEnv === 'test',
    handler: (_req, res) => { res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde e tente novamente.' } }); },
  });

export const loginRateLimit = createLimiter(15 * 60 * 1000, 10);
export const sessionRateLimit = createLimiter(15 * 60 * 1000, 20);
export const movementRateLimit = createLimiter(60 * 1000, 30);
