import { Prisma } from '../generated/prisma/client.ts';

// Conferir se o erro é violação de chave única
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Conferir se o erro é conflito de escrita ou deadlock que pode ser repetido
export function isWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}
