import { Router } from 'express';
import { container } from '../container.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { updateAccountStatusSchema } from '../schemas/account.schemas.js';
import { accountNumberParamsSchema } from '../schemas/common.schemas.js';

// Registrar a rota geral de bloqueio e desbloqueio de contas
export const accountRoutes = Router();
accountRoutes.use(authMiddleware);
accountRoutes.patch(
  '/:accountNumber/status',
  validate({ params: accountNumberParamsSchema, body: updateAccountStatusSchema }),
  container.accountController.changeStatus,
);
