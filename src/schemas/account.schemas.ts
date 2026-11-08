import { z } from './zodOpenApi.js';
import { paginationSchema, accountIdParamsSchema } from './common.schemas.js';

// Validar o tipo de conta que será aberta no atendimento
export const openAccountSchema = z.object({ type: z.enum(['CHECKING', 'SAVINGS']) });

// Validar paginação de contas do cliente atendido
export const listAccountsSchema = paginationSchema;

// Validar dados para bloquear ou desbloquear uma conta
export const updateAccountStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('BLOCKED'), reason: z.string().trim().min(3).max(240) }),
  z.object({ status: z.literal('ACTIVE') }),
]);

export { accountIdParamsSchema };
