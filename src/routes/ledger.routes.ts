import { Router } from 'express';
import { container } from '../container.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

// Registrar a rota geral de conciliação do ledger
export const ledgerRoutes = Router();
ledgerRoutes.use(authMiddleware);
ledgerRoutes.get('/reconciliation', container.ledgerController.getReconciliation);
