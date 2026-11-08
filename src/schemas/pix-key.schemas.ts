import { z } from './zodOpenApi.js';
import { accountNumberSchema, paginationSchema, recordIdParamsSchema } from './common.schemas.js';

// Validar os dados para cadastrar uma chave Pix na conta atendida
export const createPixKeySchema = z.object({
  accountNumber: accountNumberSchema,
  keyType: z.enum(['CPF', 'EMAIL', 'PHONE', 'RANDOM']),
  keyValue: z.string().trim().min(1).max(254).optional(),
});

// Validar a conta de destino ao mover uma chave Pix
export const updatePixKeySchema = z.object({ accountNumber: accountNumberSchema });

// Validar paginação da lista de chaves Pix
export const listPixKeysSchema = paginationSchema;

export { recordIdParamsSchema };
