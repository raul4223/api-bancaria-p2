import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { CustomerService } from '../services/CustomerService.js';
import type {
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from '../schemas/customer.schemas.js';

// Controller que recebe requisições HTTP do CRUD de clientes
export class CustomerController {
  // Receber o service de clientes
  constructor(private readonly customerService: CustomerService) {}

  // Criar cliente e devolver HTTP 201
  create = async (req: Request, res: Response) => {
    const result = await this.customerService.create(
      req.body as z.infer<typeof createCustomerSchema>,
    );
    res.status(201).json(result);
  };

  // Listar clientes com os filtros validados
  list = async (req: Request, res: Response) => {
    const result = await this.customerService.list(
      req.validatedQuery as z.infer<typeof listCustomersSchema>,
    );
    res.status(200).json(result);
  };

  // Buscar um cliente pelo CPF
  getById = async (req: Request, res: Response) => {
    const result = await this.customerService.getById(req.params.cpf as string);
    res.status(200).json(result);
  };

  // Atualizar dados permitidos do cliente
  update = async (req: Request, res: Response) => {
    const result = await this.customerService.update(
      req.params.cpf as string,
      req.body as z.infer<typeof updateCustomerSchema>,
    );
    res.status(200).json(result);
  };

  // Excluir cliente sem histórico e devolver HTTP 204
  delete = async (req: Request, res: Response) => {
    await this.customerService.delete(req.params.cpf as string);
    res.status(204).send();
  };
}
