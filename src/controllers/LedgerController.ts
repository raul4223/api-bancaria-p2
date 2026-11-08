import type { Request, Response } from 'express';
import type { LedgerService } from '../services/LedgerService.js';

// Controller que devolve o resultado da conciliação do ledger
export class LedgerController {
  // Receber o service de conciliação
  constructor(private readonly ledgerService: LedgerService) {}

  // Conciliar saldos de contas e partidas financeiras
  getReconciliation = async (_req: Request, res: Response) => {
    const result = await this.ledgerService.getReconciliation();
    res.status(200).json(result);
  };
}
