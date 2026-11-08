import { z } from './zodOpenApi.js';
import { paginationSchema, accountIdParamsSchema } from './common.schemas.js';

const amountSchema = z
  .string()
  .regex(/^\d+$/)
  .refine((value) => BigInt(value) > 0n);

// Validar os dados de depósito em uma conta do cliente atendido
export const depositSchema = z.object({
  accountId: z.string().uuid(),
  amountCents: amountSchema,
  description: z.string().trim().max(240).optional(),
});

// Validar os dados de saque em uma conta do cliente atendido
export const withdrawalSchema = z.object({
  accountId: z.string().uuid(),
  amountCents: amountSchema,
  description: z.string().trim().max(240).optional(),
});

// Validar os formatos de destino aceitos para cada tipo de transferência
export const transferSchema = z.discriminatedUnion('transferType', [
  z.object({
    transferType: z.literal('PIX'),
    sourceAccountId: z.string().uuid(),
    amountCents: amountSchema,
    pixKey: z.string().trim().min(1).max(254),
    description: z.string().trim().max(240).optional(),
  }),
  z.object({
    transferType: z.literal('TED'),
    sourceAccountId: z.string().uuid(),
    amountCents: amountSchema,
    destinationAgency: z.string().regex(/^\d{4}$/),
    destinationAccountNumber: z.string().min(1).max(12),
    description: z.string().trim().max(240).optional(),
  }),
  z.object({
    transferType: z.literal('INTERNAL'),
    sourceAccountId: z.string().uuid(),
    destinationAccountId: z.string().uuid(),
    amountCents: amountSchema,
    description: z.string().trim().max(240).optional(),
  }),
]);

// Validar filtros e paginação de extrato de uma conta
export const statementQuerySchema = paginationSchema.extend({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']).optional(),
  transferType: z.enum(['PIX', 'TED', 'INTERNAL']).optional(),
});

export { accountIdParamsSchema };
