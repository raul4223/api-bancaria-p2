import { z } from './zodOpenApi.js';
import { isValidCpf, normalizeCpf } from '../utils/cpf.js';
import { isWeakCustomerPassword } from '../utils/customerPassword.js';
import { paginationSchema, customerIdParamsSchema } from './common.schemas.js';

// Validar os dados de cadastro de um cliente
export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  cpf: z.string().transform(normalizeCpf).refine(isValidCpf, 'CPF inválido'),
  email: z.string().email().max(254).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  customerPassword: z.string().refine((value) => !isWeakCustomerPassword(value), 'Senha fraca'),
});

// Validar os campos permitidos para atualização de cliente
export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().max(254).nullable().optional(),
  phone: z.string().trim().min(10).max(20).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Envie ao menos um campo para atualizar');

// Validar filtros e paginação da lista de clientes
export const listCustomersSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  cpf: z.string().transform(normalizeCpf).refine(isValidCpf).optional(),
});

export { customerIdParamsSchema };
