import { z } from './zodOpenApi.js';
import { paginationSchema, recordIdParamsSchema } from './common.schemas.js';

// Validar destino Pix salvo na agenda do cliente
export const createBeneficiarySchema = z.discriminatedUnion('transferType', [
  z.object({ nickname: z.string().trim().min(1).max(80), transferType: z.literal('PIX'), pixKey: z.string().trim().min(1).max(254) }),
  z.object({ nickname: z.string().trim().min(1).max(80), transferType: z.literal('TED'), destinationAgency: z.string().regex(/^\d{4}$/), destinationAccountNumber: z.string().min(1).max(12) }),
]);

// Validar campos parciais permitidos para atualizar favorecido
export const updateBeneficiarySchema = z.object({
  nickname: z.string().trim().min(1).max(80).optional(),
  transferType: z.enum(['PIX', 'TED']).optional(),
  pixKey: z.string().trim().min(1).max(254).nullable().optional(),
  destinationAgency: z.string().regex(/^\d{4}$/).nullable().optional(),
  destinationAccountNumber: z.string().min(1).max(12).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Envie ao menos um campo para atualizar');

// Validar paginação da lista de favorecidos
export const listBeneficiariesSchema = paginationSchema;

export { recordIdParamsSchema };
