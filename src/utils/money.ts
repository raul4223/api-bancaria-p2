import { env } from '../config/env.js';
import { appErrors } from '../errors/appErrors.js';

// Converter uma string de centavos inteiros em bigint positivo dentro do teto
export function parseCents(value: string, maxCents: bigint = env.maxOperationCents): bigint {
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) throw appErrors.invalidAmount();
  const cents = BigInt(value);
  if (cents > maxCents) throw appErrors.amountAboveLimit();
  return cents;
}

// Converter centavos em string decimal segura para JSON
export function formatCents(value: bigint): string {
  return value.toString();
}

// Somar valores monetários sem conversão para ponto flutuante
export function addCents(...values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}
