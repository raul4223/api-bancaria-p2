import { z } from './zodOpenApi.js';
import {
  paginationSchema,
  accountNumberParamsSchema,
  accountNumberSchema,
} from './common.schemas.js';

const amountSchema = z
  .string()
  .regex(/^\d{1,15}$/)
  .refine((value) => BigInt(value) > 0n)
  .openapi({ example: '30000', description: 'Valor em centavos, como string' });

// Validar os dados de depósito em uma conta do cliente atendido
export const depositSchema = z.object({
  accountNumber: accountNumberSchema,
  amountCents: amountSchema,
  description: z.string().trim().max(240).optional(),
});

// Validar os dados de saque em uma conta do cliente atendido
export const withdrawalSchema = z.object({
  accountNumber: accountNumberSchema,
  amountCents: amountSchema,
  description: z.string().trim().max(240).optional(),
});

// Validar os formatos de destino aceitos para cada tipo de transferência
export const transferSchema = z.discriminatedUnion('transferType', [
  z.object({
    transferType: z.literal('PIX'),
    sourceAccountNumber: accountNumberSchema,
    amountCents: amountSchema,
    pixKey: z.string().trim().min(1).max(254),
    description: z.string().trim().max(240).optional(),
  }),
  z.object({
    transferType: z.literal('TED'),
    sourceAccountNumber: accountNumberSchema,
    amountCents: amountSchema,
    destinationAgency: z.string().regex(/^\d{4}$/),
    destinationAccountNumber: z.string().min(1).max(12),
    description: z.string().trim().max(240).optional(),
  }),
  z.object({
    transferType: z.literal('INTERNAL'),
    sourceAccountNumber: accountNumberSchema,
    destinationAccountNumber: accountNumberSchema,
    amountCents: amountSchema,
    description: z.string().trim().max(240).optional(),
  }),
  z.object({
    transferType: z.literal('BENEFICIARY'),
    sourceAccountNumber: accountNumberSchema,
    beneficiaryId: z.string().uuid(),
    amountCents: amountSchema,
    description: z.string().trim().max(240).optional(),
  }),
]);

// Validar filtros e paginação de extrato de uma conta
export const statementQuerySchema = paginationSchema
  .extend({
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
    type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']).optional(),
    transferType: z.enum(['PIX', 'TED', 'INTERNAL']).optional(),
  })
  .refine((query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to), {
    message: 'A data inicial deve ser anterior à final',
    path: ['to'],
  });

export { accountNumberParamsSchema };
