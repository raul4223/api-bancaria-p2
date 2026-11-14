import type { RequestHandler } from 'express';
import { container } from '../container.js';
import { appErrors } from '../errors/appErrors.js';
import { verifyAccessToken } from '../utils/token.js';

// Exigir um JWT válido do operador master
export const authMiddleware: RequestHandler = async (req, _res, next) => {
  const authorization = req.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(appErrors.unauthorized());
  const operatorUserId = await verifyAccessToken(match[1]!);
  if (!operatorUserId || !(await container.authService.isOperatorActive(operatorUserId)))
    return next(appErrors.unauthorized());
  req.auth = { operatorUserId };
  next();
};
