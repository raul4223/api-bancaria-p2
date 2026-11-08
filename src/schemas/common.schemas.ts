import { z } from './zodOpenApi.js';
import { isValidAccountNumber } from '../utils/bankAccount.js';
import { isValidCpf, normalizeCpf } from '../utils/cpf.js';

export const uuidSchema = z.string().uuid();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const cpfSchema = z
  .string()
  .transform(normalizeCpf)
  .refine(isValidCpf, 'CPF inválido')
  .openapi({ example: '52998224725', description: 'CPF do cliente, com ou sem máscara' });
export const accountNumberSchema = z
  .string()
  .refine(isValidAccountNumber, 'Número de conta inválido')
  .openapi({ example: '1234567', description: 'Número da conta (7 dígitos) na agência 0001' });
export const customerCpfParamsSchema = z.object({ cpf: cpfSchema });
export const accountNumberParamsSchema = z.object({ accountNumber: accountNumberSchema });
export const recordIdParamsSchema = z.object({ id: uuidSchema });
export const sessionIdParamsSchema = z.object({ serviceSessionId: uuidSchema });
export const idempotencyHeaderSchema = z.object({ 'idempotency-key': z.string().uuid() });
