import { maskAccountNumber } from './mask.js';

// Converter BigInt em string sem perder precisão no JSON
export function presentBigInts<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, entry: unknown) => typeof entry === 'bigint' ? entry.toString() : entry)) as T;
}

// Formatar conta sem revelar por inteiro os dados de destino
export function presentAccount<T extends { number: string }>(account: T): T & { number: string } {
  return { ...account, number: maskAccountNumber(account.number) };
}

// Remover hash de senha antes de devolver um registro HTTP
export function omitPasswordHash<T extends { passwordHash: string }>(value: T): Omit<T, 'passwordHash'> {
  const safe = { ...value } as Omit<T, 'passwordHash'> & { passwordHash?: string };
  delete safe.passwordHash;
  return safe as Omit<T, 'passwordHash'>;
}
