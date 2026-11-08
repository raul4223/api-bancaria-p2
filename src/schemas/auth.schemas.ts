import { z } from './zodOpenApi.js';

// Validar as credenciais de acesso do operador
export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});
