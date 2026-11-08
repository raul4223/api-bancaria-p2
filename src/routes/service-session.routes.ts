import { Router } from 'express';
import { container } from '../container.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { sessionRateLimit } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { sessionIdParamsSchema } from '../schemas/common.schemas.js';
import { openServiceSessionSchema } from '../schemas/service-session.schemas.js';

// Registrar rotas de abertura e encerramento de atendimento
export const serviceSessionRoutes = Router();
serviceSessionRoutes.use(authMiddleware);
serviceSessionRoutes.post(
  '/',
  sessionRateLimit,
  validate({ body: openServiceSessionSchema }),
  container.serviceSessionController.open,
);
serviceSessionRoutes.patch(
  '/:serviceSessionId/close',
  validate({ params: sessionIdParamsSchema }),
  container.serviceSessionController.close,
);
