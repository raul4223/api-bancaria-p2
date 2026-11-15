import type { Prisma } from '../generated/prisma/client.ts';
import { prisma } from './prisma.js';

export type DatabaseClient = Prisma.TransactionClient | typeof prisma;
type TransactionOptions = { maxWait?: number; timeout?: number };

// Abrir transações do banco sem expor o Prisma aos services
export class TransactionManager {
  // Executar o bloco dentro de uma transação e repassar o cliente transacional
  run<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    return prisma.$transaction(work, options);
  }
}
