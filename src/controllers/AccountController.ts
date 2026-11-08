import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { AccountService } from '../services/AccountService.js';
import type { listAccountsSchema, openAccountSchema, updateAccountStatusSchema } from '../schemas/account.schemas.js';
import { presentBigInts } from '../utils/presenters.js';

// Controller que recebe requisições de contas
export class AccountController {
  // Receber o service de contas
  constructor(private readonly accountService: AccountService) {}

  // Abrir uma conta para o cliente atendido
  open = async (req: Request, res: Response) => {
    const result = await this.accountService.open(req.body as z.infer<typeof openAccountSchema>, req.serviceSession!.customerId);
    res.status(201).json(presentBigInts(result));
  };

  // Listar contas do cliente atendido
  list = async (req: Request, res: Response) => {
    const result = await this.accountService.list(req.validatedQuery as z.infer<typeof listAccountsSchema>, req.serviceSession!.customerId);
    res.status(200).json(presentBigInts(result));
  };

  // Buscar conta do cliente atendido pelo ID
  getById = async (req: Request, res: Response) => {
    const result = await this.accountService.getById(req.params.accountId as string, req.serviceSession!.customerId);
    res.status(200).json(result);
  };

  // Bloquear ou desbloquear uma conta como operação geral
  changeStatus = async (req: Request, res: Response) => {
    const result = await this.accountService.changeStatus(req.params.accountId as string, req.body as z.infer<typeof updateAccountStatusSchema>, req.auth!.operatorUserId);
    res.status(200).json(result);
  };
}
