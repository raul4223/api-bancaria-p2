import { Router } from 'express';
import { container } from '../container.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { serviceSessionMiddleware } from '../middlewares/serviceSessionMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { customerCpfParamsSchema } from '../schemas/common.schemas.js';
import {
  createCustomerSchema,
  listCustomersSchema,
  resetCustomerPasswordSchema,
  updateCustomerSchema,
} from '../schemas/customer.schemas.js';

// Registrar rotas do CRUD de clientes (operação geral)
export const customerRoutes = Router();
customerRoutes.use(authMiddleware);
customerRoutes.post(
  '/',
  validate({ body: createCustomerSchema }),
  container.customerController.create,
);
customerRoutes.get(
  '/',
  validate({ query: listCustomersSchema }),
  container.customerController.list,
);
customerRoutes.get(
  '/:cpf',
  validate({ params: customerCpfParamsSchema }),
  container.customerController.getById,
);
customerRoutes.patch(
  '/:cpf',
  serviceSessionMiddleware(container.serviceSessionService),
  validate({ params: customerCpfParamsSchema, body: updateCustomerSchema }),
  container.customerController.update,
);
customerRoutes.patch(
  '/:cpf/password',
  validate({ params: customerCpfParamsSchema, body: resetCustomerPasswordSchema }),
  container.customerController.resetPassword,
);
customerRoutes.delete(
  '/:cpf',
  validate({ params: customerCpfParamsSchema }),
  container.customerController.delete,
);
