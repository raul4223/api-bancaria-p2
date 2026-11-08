import type { Request, Response } from 'express';
import type { ServiceSessionService } from '../services/ServiceSessionService.js';
import type { z } from 'zod';
import type { openServiceSessionSchema } from '../schemas/service-session.schemas.js';

// Controller que recebe requisições de abertura e fechamento de atendimento
export class ServiceSessionController {
  // Receber o service de atendimento
  constructor(private readonly serviceSessionService: ServiceSessionService) {}

  // Abrir atendimento depois da senha do cliente ser confirmada
  open = async (req: Request, res: Response) => {
    const result = await this.serviceSessionService.open(req.body as z.infer<typeof openServiceSessionSchema>, req.auth!.operatorUserId);
    res.status(201).json(result);
  };

  // Encerrar atendimento aberto pelo operador autenticado
  close = async (req: Request, res: Response) => {
    const result = await this.serviceSessionService.close(req.params.serviceSessionId as string, req.auth!.operatorUserId);
    res.status(200).json(result);
  };
}
