import { Router } from 'express';
import { container } from '../container.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import {
  listAccountStatusHistorySchema,
  updateAccountStatusSchema,
} from '../schemas/account.schemas.js';
import { accountNumberParamsSchema } from '../schemas/common.schemas.js';

// Registrar as rotas gerais de bloqueio, desbloqueio e histórico de status de contas
export const accountRoutes = Router();
accountRoutes.use(authMiddleware);
accountRoutes.patch(
  '/:accountNumber/status',
  validate({ params: accountNumberParamsSchema, body: updateAccountStatusSchema }),
  container.accountController.changeStatus,
);
accountRoutes.get(
  '/:accountNumber/status-history',
  validate({ params: accountNumberParamsSchema, query: listAccountStatusHistorySchema }),
  container.accountController.listStatusHistory,
);
