import { Router } from 'express';
import { container } from '../container.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { movementRateLimit } from '../middlewares/rateLimit.js';
import { serviceSessionMiddleware } from '../middlewares/serviceSessionMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { listAccountsSchema, openAccountSchema } from '../schemas/account.schemas.js';
import {
  createBeneficiarySchema,
  listBeneficiariesSchema,
  updateBeneficiarySchema,
} from '../schemas/beneficiary.schemas.js';
import {
  accountIdParamsSchema,
  idempotencyHeaderSchema,
  recordIdParamsSchema,
} from '../schemas/common.schemas.js';
import {
  createPixKeySchema,
  listPixKeysSchema,
  updatePixKeySchema,
} from '../schemas/pix-key.schemas.js';
import {
  depositSchema,
  statementQuerySchema,
  transferSchema,
  withdrawalSchema,
} from '../schemas/transaction.schemas.js';

const movementHeaders = idempotencyHeaderSchema.extend({
  'x-service-session-id': idempotencyHeaderSchema.shape['idempotency-key'],
});

// Registrar rotas em nome do cliente, que exigem JWT e atendimento aberto
export const customerServiceRoutes = Router();
customerServiceRoutes.use(
  authMiddleware,
  serviceSessionMiddleware(container.serviceSessionService),
);

customerServiceRoutes.post(
  '/accounts',
  validate({ body: openAccountSchema }),
  container.accountController.open,
);
customerServiceRoutes.get(
  '/accounts',
  validate({ query: listAccountsSchema }),
  container.accountController.list,
);
customerServiceRoutes.get(
  '/accounts/:accountId',
  validate({ params: accountIdParamsSchema }),
  container.accountController.getById,
);
customerServiceRoutes.get(
  '/accounts/:accountId/statement',
  validate({ params: accountIdParamsSchema, query: statementQuerySchema }),
  container.transactionController.getStatement,
);

customerServiceRoutes.post(
  '/transactions/deposits',
  movementRateLimit,
  validate({ body: depositSchema, headers: movementHeaders }),
  container.transactionController.deposit,
);
customerServiceRoutes.post(
  '/transactions/withdrawals',
  movementRateLimit,
  validate({ body: withdrawalSchema, headers: movementHeaders }),
  container.transactionController.withdraw,
);
customerServiceRoutes.post(
  '/transactions/transfers',
  movementRateLimit,
  validate({ body: transferSchema, headers: movementHeaders }),
  container.transactionController.transfer,
);

customerServiceRoutes.post(
  '/pix-keys',
  validate({ body: createPixKeySchema }),
  container.pixKeyController.create,
);
customerServiceRoutes.get(
  '/pix-keys',
  validate({ query: listPixKeysSchema }),
  container.pixKeyController.list,
);
customerServiceRoutes.get(
  '/pix-keys/:id',
  validate({ params: recordIdParamsSchema }),
  container.pixKeyController.getById,
);
customerServiceRoutes.patch(
  '/pix-keys/:id',
  validate({ params: recordIdParamsSchema, body: updatePixKeySchema }),
  container.pixKeyController.update,
);
customerServiceRoutes.delete(
  '/pix-keys/:id',
  validate({ params: recordIdParamsSchema }),
  container.pixKeyController.delete,
);

customerServiceRoutes.post(
  '/beneficiaries',
  validate({ body: createBeneficiarySchema }),
  container.beneficiaryController.create,
);
customerServiceRoutes.get(
  '/beneficiaries',
  validate({ query: listBeneficiariesSchema }),
  container.beneficiaryController.list,
);
customerServiceRoutes.get(
  '/beneficiaries/:id',
  validate({ params: recordIdParamsSchema }),
  container.beneficiaryController.getById,
);
customerServiceRoutes.patch(
  '/beneficiaries/:id',
  validate({ params: recordIdParamsSchema, body: updateBeneficiarySchema }),
  container.beneficiaryController.update,
);
customerServiceRoutes.delete(
  '/beneficiaries/:id',
  validate({ params: recordIdParamsSchema }),
  container.beneficiaryController.delete,
);
