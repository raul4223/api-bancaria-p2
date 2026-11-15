import { appErrors } from '../errors/appErrors.js';

// Converter uma string de centavos inteiros em bigint positivo
export function parseCents(value: string): bigint {
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) throw appErrors.invalidAmount();
  return BigInt(value);
}

// Converter centavos em string decimal segura para JSON
export function formatCents(value: bigint): string {
  return value.toString();
}
