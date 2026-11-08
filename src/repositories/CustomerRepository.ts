import { prisma } from '../database/prisma.js';
import type { Prisma } from '../generated/prisma/client.ts';

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

// Repository que acessa a tabela de clientes
export class CustomerRepository {
  // Criar cliente com senha já protegida por hash
  create(data: Prisma.CustomerUncheckedCreateInput, client: DatabaseClient = prisma) {
    return client.customer.create({ data });
  }

  // Listar clientes paginados com agência, número e saldo de cada conta
  findMany(args: { where: Prisma.CustomerWhereInput; skip: number; take: number }) {
    return prisma.customer.findMany({
      where: args.where,
      skip: args.skip,
      take: args.take,
      orderBy: { createdAt: 'desc' },
      include: {
        accounts: {
          select: { agency: true, number: true, type: true, status: true, balanceCents: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  // Contar clientes que correspondem aos filtros informados
  count(where: Prisma.CustomerWhereInput) {
    return prisma.customer.count({ where });
  }

  // Buscar cliente pelo ID com suas contas
  findById(id: string) {
    return prisma.customer.findUnique({ where: { id }, include: { accounts: true } });
  }

  // Buscar cliente pelo CPF com suas contas
  findByCpf(cpf: string) {
    return prisma.customer.findUnique({
      where: { cpf },
      include: { accounts: { orderBy: { createdAt: 'asc' } } },
    });
  }

  // Atualizar somente os dados de contato permitidos
  update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { id }, data });
  }

  // Excluir cliente e suas contas sem movimentação numa única transação
  delete(id: string) {
    return prisma.$transaction([
      prisma.account.deleteMany({ where: { customerId: id } }),
      prisma.customer.delete({ where: { id } }),
    ]);
  }

  // Contar atendimentos, movimentações e saldo das contas antes da exclusão física
  async getHistorySummary(id: string) {
    const [sessionCount, transactionCount, ledgerEntryCount, accountsWithBalance] =
      await Promise.all([
        prisma.serviceSession.count({ where: { customerId: id } }),
        prisma.bankTransaction.count({
          where: {
            OR: [{ sourceAccount: { customerId: id } }, { destinationAccount: { customerId: id } }],
          },
        }),
        prisma.ledgerEntry.count({ where: { account: { customerId: id } } }),
        prisma.account.count({ where: { customerId: id, balanceCents: { not: 0n } } }),
      ]);
    return { sessionCount, transactionCount, ledgerEntryCount, accountsWithBalance };
  }
}
