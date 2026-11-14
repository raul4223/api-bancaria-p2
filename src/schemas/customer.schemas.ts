import { z } from './zodOpenApi.js';
import { isWeakCustomerPassword } from '../utils/customerPassword.js';
import { cpfSchema, customerCpfParamsSchema, paginationSchema } from './common.schemas.js';

const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => /^\d{10,11}$/.test(value), 'Telefone inválido')
  .openapi({ example: '11987654321', description: 'DDD + número, com ou sem máscara' });

// Validar os dados de cadastro de um cliente
export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  cpf: cpfSchema,
  email: z.string().email().max(254).optional(),
  phone: phoneSchema.optional(),
  customerPassword: z.string().refine((value) => !isWeakCustomerPassword(value), 'Senha fraca'),
  accountType: z
    .enum(['CHECKING', 'SAVINGS'])
    .default('CHECKING')
    .openapi({
      description: 'Tipo da primeira conta, aberta junto com o cadastro (padrão: corrente)',
    }),
});

// Validar os campos permitidos para atualização de cliente
export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().email().max(254).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Envie ao menos um campo para atualizar');

// Validar a nova senha e a confirmação de que o documento foi conferido
export const resetCustomerPasswordSchema = z.object({
  newCustomerPassword: z.string().refine((value) => !isWeakCustomerPassword(value), 'Senha fraca'),
  identityConfirmed: z
    .literal(true)
    .openapi({ description: 'O operador conferiu o documento original com foto do cliente' }),
});

// Validar filtros e paginação da lista de clientes
export const listCustomersSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  cpf: cpfSchema.optional(),
});

export { customerCpfParamsSchema };
