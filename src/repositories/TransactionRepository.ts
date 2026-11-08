import { prisma } from '../database/prisma.js';
import type { Prisma } from '../generated/prisma/client.ts';

type DatabaseClient = Prisma.TransactionClient | typeof prisma;
type StatementFilters = {
  accountId: string;
  skip?: number;
  take?: number;
  from?: Date | undefined;
  to?: Date | undefined;
  type?: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | undefined;
  transferType?: 'PIX' | 'TED' | 'INTERNAL' | undefined;
};

// Montar filtros sem enviar propriedades indefinidas ao Prisma
function buildStatementWhere(args: StatementFilters): Prisma.BankTransactionWhereInput {
  const createdAt = {
    ...(args.from ? { gte: args.from } : {}),
    ...(args.to ? { lte: args.to } : {}),
  };
  return {
    OR: [{ sourceAccountId: args.accountId }, { destinationAccountId: args.accountId }],
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    ...(args.type ? { type: args.type } : {}),
    ...(args.transferType ? { transferType: args.transferType } : {}),
  };
}

// Repository que registra transações financeiras e partidas do ledger
export class TransactionRepository {
  // Buscar operação anterior pela chave de idempotência do operador
  findIdempotent(operatorUserId: string, idempotencyKey: string) {
    return prisma.bankTransaction.findUnique({
      where: { operatorUserId_idempotencyKey: { operatorUserId, idempotencyKey } },
    });
  }

  // Registrar transação dentro do cliente Prisma informado
  create(data: Prisma.BankTransactionUncheckedCreateInput, client: DatabaseClient) {
    return client.bankTransaction.create({ data });
  }

  // Guardar a resposta final para devolver a mesma operação em reenvios
  updateResult(id: string, resultData: Prisma.InputJsonValue, client: DatabaseClient) {
    return client.bankTransaction.update({ where: { id }, data: { resultData } });
  }

  // Registrar lançamentos imutáveis do ledger dentro da transação
  createLedgerEntries(data: Prisma.LedgerEntryCreateManyInput[], client: DatabaseClient) {
    return client.ledgerEntry.createMany({ data });
  }

  // Buscar operações da conta com operador e contas de origem e destino
  findStatement(args: StatementFilters & { skip: number; take: number }) {
    return prisma.bankTransaction.findMany({
      where: buildStatementWhere(args),
      skip: args.skip,
      take: args.take,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        operator: { select: { id: true, name: true } },
        sourceAccount: { include: { customer: { select: { name: true } } } },
        destinationAccount: { include: { customer: { select: { name: true } } } },
      },
    });
  }

  // Contar operações da conta com os mesmos filtros do extrato
  countStatement(args: StatementFilters) {
    return prisma.bankTransaction.count({
      where: buildStatementWhere(args),
    });
  }

  // Agrupar partidas por conta e direção para conciliação
  groupLedger() {
    return prisma.ledgerEntry.groupBy({
      by: ['accountId', 'direction'],
      _sum: { amountCents: true },
    });
  }

  // Listar saldos materializados para comparar com o ledger
  findAccountBalances() {
    return prisma.account.findMany({
      select: { id: true, number: true, type: true, balanceCents: true },
    });
  }
}
