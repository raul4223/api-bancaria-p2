import { Router } from 'express';
import { container } from '../container.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { updateAccountStatusSchema } from '../schemas/account.schemas.js';
import { accountIdParamsSchema } from '../schemas/common.schemas.js';

// Registrar a rota geral de bloqueio e desbloqueio de contas
export const accountRoutes = Router();
accountRoutes.use(authMiddleware);
accountRoutes.patch(
  '/:accountId/status',
  validate({ params: accountIdParamsSchema, body: updateAccountStatusSchema }),
  container.accountController.changeStatus,
);
