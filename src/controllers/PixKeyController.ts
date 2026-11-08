import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { PixKeyService } from '../services/PixKeyService.js';
import type {
  createPixKeySchema,
  listPixKeysSchema,
  updatePixKeySchema,
} from '../schemas/pix-key.schemas.js';

// Controller que recebe requisições do CRUD de chaves Pix
export class PixKeyController {
  // Receber o service de chaves Pix
  constructor(private readonly pixKeyService: PixKeyService) {}

  // Cadastrar uma chave Pix para o cliente atendido
  create = async (req: Request, res: Response) => {
    const result = await this.pixKeyService.create(
      req.body as z.infer<typeof createPixKeySchema>,
      req.serviceSession!.customerId,
    );
    res.status(201).json(result);
  };

  // Listar chaves Pix do cliente em atendimento
  list = async (req: Request, res: Response) => {
    const result = await this.pixKeyService.list(
      req.validatedQuery as z.infer<typeof listPixKeysSchema>,
      req.serviceSession!.customerId,
    );
    res.status(200).json(result);
  };

  // Buscar uma chave Pix dentro da agenda do cliente atendido
  getById = async (req: Request, res: Response) => {
    const result = await this.pixKeyService.getById(
      req.params.id as string,
      req.serviceSession!.customerId,
    );
    res.status(200).json(result);
  };

  // Mover chave Pix entre contas do mesmo cliente
  update = async (req: Request, res: Response) => {
    const result = await this.pixKeyService.update(
      req.params.id as string,
      req.body as z.infer<typeof updatePixKeySchema>,
      req.serviceSession!.customerId,
    );
    res.status(200).json(result);
  };

  // Excluir chave Pix e devolver HTTP 204
  delete = async (req: Request, res: Response) => {
    await this.pixKeyService.delete(req.params.id as string, req.serviceSession!.customerId);
    res.status(204).send();
  };
}
