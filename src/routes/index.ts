import { Router } from 'express';
import { container } from '../container.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { serviceSessionMiddleware } from '../middlewares/serviceSessionMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { loginRateLimit, movementRateLimit, sessionRateLimit } from '../middlewares/rateLimit.js';
import { loginSchema } from '../schemas/auth.schemas.js';
import { createCustomerSchema, listCustomersSchema, updateCustomerSchema } from '../schemas/customer.schemas.js';
import { openServiceSessionSchema } from '../schemas/service-session.schemas.js';
import { accountIdParamsSchema, customerIdParamsSchema, recordIdParamsSchema, sessionIdParamsSchema } from '../schemas/common.schemas.js';
import { listAccountsSchema, openAccountSchema, updateAccountStatusSchema } from '../schemas/account.schemas.js';
import { depositSchema, statementQuerySchema, transferSchema, withdrawalSchema } from '../schemas/transaction.schemas.js';
import { createPixKeySchema, listPixKeysSchema, updatePixKeySchema } from '../schemas/pix-key.schemas.js';
import { createBeneficiarySchema, listBeneficiariesSchema, updateBeneficiarySchema } from '../schemas/beneficiary.schemas.js';
import { idempotencyHeaderSchema } from '../schemas/common.schemas.js';

export const apiRoutes = Router();

// Registrar autenticação pública e proteger todas as rotas seguintes
apiRoutes.post('/auth/login', loginRateLimit, validate({ body: loginSchema }), container.authController.login);
apiRoutes.use(authMiddleware);

apiRoutes.post('/customers', validate({ body: createCustomerSchema }), container.customerController.create);
apiRoutes.get('/customers', validate({ query: listCustomersSchema }), container.customerController.list);
apiRoutes.get('/customers/:customerId', validate({ params: customerIdParamsSchema }), container.customerController.getById);
apiRoutes.patch('/customers/:customerId', validate({ params: customerIdParamsSchema, body: updateCustomerSchema }), container.customerController.update);
apiRoutes.delete('/customers/:customerId', validate({ params: customerIdParamsSchema }), container.customerController.delete);

apiRoutes.post('/service-sessions', sessionRateLimit, validate({ body: openServiceSessionSchema }), container.serviceSessionController.open);
apiRoutes.patch('/service-sessions/:serviceSessionId/close', validate({ params: sessionIdParamsSchema }), container.serviceSessionController.close);

const requireServiceSession = serviceSessionMiddleware(container.serviceSessionService);
apiRoutes.post('/customer-service/accounts', requireServiceSession, validate({ body: openAccountSchema }), container.accountController.open);
apiRoutes.get('/customer-service/accounts', requireServiceSession, validate({ query: listAccountsSchema }), container.accountController.list);
apiRoutes.get('/customer-service/accounts/:accountId', requireServiceSession, validate({ params: accountIdParamsSchema }), container.accountController.getById);
apiRoutes.patch('/accounts/:accountId/status', validate({ params: accountIdParamsSchema, body: updateAccountStatusSchema }), container.accountController.changeStatus);
apiRoutes.get('/ledger/reconciliation', container.ledgerController.getReconciliation);

const idempotencyHeaders = idempotencyHeaderSchema.extend({ 'x-service-session-id': idempotencyHeaderSchema.shape['idempotency-key'] });
apiRoutes.post('/customer-service/transactions/deposits', requireServiceSession, movementRateLimit, validate({ body: depositSchema, headers: idempotencyHeaders }), container.transactionController.deposit);
apiRoutes.post('/customer-service/transactions/withdrawals', requireServiceSession, movementRateLimit, validate({ body: withdrawalSchema, headers: idempotencyHeaders }), container.transactionController.withdraw);
apiRoutes.post('/customer-service/transactions/transfers', requireServiceSession, movementRateLimit, validate({ body: transferSchema, headers: idempotencyHeaders }), container.transactionController.transfer);
apiRoutes.get('/customer-service/accounts/:accountId/statement', requireServiceSession, validate({ params: accountIdParamsSchema, query: statementQuerySchema }), container.transactionController.getStatement);

apiRoutes.post('/customer-service/pix-keys', requireServiceSession, validate({ body: createPixKeySchema }), container.pixKeyController.create);
apiRoutes.get('/customer-service/pix-keys', requireServiceSession, validate({ query: listPixKeysSchema }), container.pixKeyController.list);
apiRoutes.get('/customer-service/pix-keys/:id', requireServiceSession, validate({ params: recordIdParamsSchema }), container.pixKeyController.getById);
apiRoutes.patch('/customer-service/pix-keys/:id', requireServiceSession, validate({ params: recordIdParamsSchema, body: updatePixKeySchema }), container.pixKeyController.update);
apiRoutes.delete('/customer-service/pix-keys/:id', requireServiceSession, validate({ params: recordIdParamsSchema }), container.pixKeyController.delete);

apiRoutes.post('/customer-service/beneficiaries', requireServiceSession, validate({ body: createBeneficiarySchema }), container.beneficiaryController.create);
apiRoutes.get('/customer-service/beneficiaries', requireServiceSession, validate({ query: listBeneficiariesSchema }), container.beneficiaryController.list);
apiRoutes.get('/customer-service/beneficiaries/:id', requireServiceSession, validate({ params: recordIdParamsSchema }), container.beneficiaryController.getById);
apiRoutes.patch('/customer-service/beneficiaries/:id', requireServiceSession, validate({ params: recordIdParamsSchema, body: updateBeneficiarySchema }), container.beneficiaryController.update);
apiRoutes.delete('/customer-service/beneficiaries/:id', requireServiceSession, validate({ params: recordIdParamsSchema }), container.beneficiaryController.delete);
