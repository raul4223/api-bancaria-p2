import { Router } from 'express';
import { container } from '../container.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { customerIdParamsSchema } from '../schemas/common.schemas.js';
import {
  createCustomerSchema,
  listCustomersSchema,
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
  '/:customerId',
  validate({ params: customerIdParamsSchema }),
  container.customerController.getById,
);
customerRoutes.patch(
  '/:customerId',
  validate({ params: customerIdParamsSchema, body: updateCustomerSchema }),
  container.customerController.update,
);
customerRoutes.delete(
  '/:customerId',
  validate({ params: customerIdParamsSchema }),
  container.customerController.delete,
);
