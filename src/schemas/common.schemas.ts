import { z } from './zodOpenApi.js';

export const uuidSchema = z.string().uuid();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const customerIdParamsSchema = z.object({ customerId: uuidSchema });
export const accountIdParamsSchema = z.object({ accountId: uuidSchema });
export const recordIdParamsSchema = z.object({ id: uuidSchema });
export const sessionIdParamsSchema = z.object({ serviceSessionId: uuidSchema });
export const idempotencyHeaderSchema = z.object({ 'idempotency-key': z.string().uuid() });
