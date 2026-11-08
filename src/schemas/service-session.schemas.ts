import { z } from './zodOpenApi.js';
import { normalizeCpf } from '../utils/cpf.js';

// Validar os dados necessários para abrir um atendimento
export const openServiceSessionSchema = z.object({
  cpf: z.string().transform(normalizeCpf).refine((value) => /^\d{11}$/.test(value), 'CPF inválido'),
  customerPassword: z.string().regex(/^\d{6}$/),
});
