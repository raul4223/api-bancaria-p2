import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { BeneficiaryService } from '../services/BeneficiaryService.js';
import type {
  createBeneficiarySchema,
  listBeneficiariesSchema,
  updateBeneficiarySchema,
} from '../schemas/beneficiary.schemas.js';

// Controller que recebe requisições do CRUD de favorecidos
export class BeneficiaryController {
  // Receber o service de favorecidos
  constructor(private readonly beneficiaryService: BeneficiaryService) {}

  // Cadastrar favorecido na agenda do cliente
  create = async (req: Request, res: Response) => {
    const result = await this.beneficiaryService.create(
      req.body as z.infer<typeof createBeneficiarySchema>,
      req.serviceSession!.customerId,
    );
    res.status(201).json(result);
  };

  // Listar favorecidos do cliente em atendimento
  list = async (req: Request, res: Response) => {
    const result = await this.beneficiaryService.list(
      req.validatedQuery as z.infer<typeof listBeneficiariesSchema>,
      req.serviceSession!.customerId,
    );
    res.status(200).json(result);
  };

  // Buscar favorecido dentro da agenda do cliente atendido
  getById = async (req: Request, res: Response) => {
    const result = await this.beneficiaryService.getById(
      req.params.id as string,
      req.serviceSession!.customerId,
    );
    res.status(200).json(result);
  };

  // Atualizar apelido ou destino de um favorecido
  update = async (req: Request, res: Response) => {
    const result = await this.beneficiaryService.update(
      req.params.id as string,
      req.body as z.infer<typeof updateBeneficiarySchema>,
      req.serviceSession!.customerId,
    );
    res.status(200).json(result);
  };

  // Excluir favorecido e devolver HTTP 204
  delete = async (req: Request, res: Response) => {
    await this.beneficiaryService.delete(req.params.id as string, req.serviceSession!.customerId);
    res.status(204).send();
  };
}
