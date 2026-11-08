import { Router } from 'express';
import { accountRoutes } from './account.routes.js';
import { authRoutes } from './auth.routes.js';
import { customerServiceRoutes } from './customer-service.routes.js';
import { customerRoutes } from './customer.routes.js';
import { ledgerRoutes } from './ledger.routes.js';
import { serviceSessionRoutes } from './service-session.routes.js';

// Montar todas as rotas da API sob /api/v1
export const apiRoutes = Router();
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/customers', customerRoutes);
apiRoutes.use('/service-sessions', serviceSessionRoutes);
apiRoutes.use('/accounts', accountRoutes);
apiRoutes.use('/ledger', ledgerRoutes);
apiRoutes.use('/customer-service', customerServiceRoutes);
