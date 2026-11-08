import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { TransactionService } from '../services/TransactionService.js';
import type { TransferService } from '../services/TransferService.js';
import type {
  depositSchema,
  statementQuerySchema,
  transferSchema,
  withdrawalSchema,
} from '../schemas/transaction.schemas.js';

// Controller que recebe depósitos, saques, transferências e consultas de extrato
export class TransactionController {
  // Receber services de movimentações e transferências
  constructor(
    private readonly transactionService: TransactionService,
    private readonly transferService: TransferService,
  ) {}

  // Depositar valor na conta com uma chave de idempotência
  deposit = async (req: Request, res: Response) => {
    const result = await this.transactionService.deposit(
      req.body as z.infer<typeof depositSchema>,
      {
        customerId: req.serviceSession!.customerId,
        operatorUserId: req.auth!.operatorUserId,
        serviceSessionId: req.serviceSession!.serviceSessionId,
        idempotencyKey: req.get('Idempotency-Key')!,
      },
    );
    res.status(result.replayed ? 200 : 201).json(result.result);
  };

  // Sacar valor da conta com uma chave de idempotência
  withdraw = async (req: Request, res: Response) => {
    const result = await this.transactionService.withdraw(
      req.body as z.infer<typeof withdrawalSchema>,
      {
        customerId: req.serviceSession!.customerId,
        operatorUserId: req.auth!.operatorUserId,
        serviceSessionId: req.serviceSession!.serviceSessionId,
        idempotencyKey: req.get('Idempotency-Key')!,
      },
    );
    res.status(result.replayed ? 200 : 201).json(result.result);
  };

  // Transferir entre contas fictícias segundo PIX, TED ou regra interna
  transfer = async (req: Request, res: Response) => {
    const result = await this.transferService.transfer(req.body as z.infer<typeof transferSchema>, {
      customerId: req.serviceSession!.customerId,
      operatorUserId: req.auth!.operatorUserId,
      serviceSessionId: req.serviceSession!.serviceSessionId,
      idempotencyKey: req.get('Idempotency-Key')!,
    });
    res.status(result.replayed ? 200 : 201).json(result.result);
  };

  // Consultar extrato paginado da conta do cliente atendido
  getStatement = async (req: Request, res: Response) => {
    const result = await this.transactionService.getStatement(
      req.validatedQuery as z.infer<typeof statementQuerySchema>,
      req.params.accountId as string,
      req.serviceSession!.customerId,
    );
    res.status(200).json(result);
  };
}
