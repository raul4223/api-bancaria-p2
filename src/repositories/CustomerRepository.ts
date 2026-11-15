import { prisma } from '../database/prisma.js';
import type { DatabaseClient } from '../database/transactionManager.js';
import type { Prisma } from '../generated/prisma/client.ts';

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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

  // Excluir cliente e suas contas sem movimentação dentro da transação recebida
  async delete(id: string, client: DatabaseClient) {
    await client.account.deleteMany({ where: { customerId: id } });
    await client.customer.delete({ where: { id } });
  }

  // Contar atendimentos, movimentações, histórico de status e saldo antes da exclusão física
  async getHistorySummary(id: string, client: DatabaseClient) {
    const sessionCount = await client.serviceSession.count({ where: { customerId: id } });
    const transactionCount = await client.bankTransaction.count({
      where: {
        OR: [{ sourceAccount: { customerId: id } }, { destinationAccount: { customerId: id } }],
      },
    });
    const ledgerEntryCount = await client.ledgerEntry.count({
      where: { account: { customerId: id } },
    });
    const accountsWithBalance = await client.account.count({
      where: { customerId: id, balanceCents: { not: 0n } },
    });
    const accountStatusHistoryCount = await client.accountStatusHistory.count({
      where: { account: { customerId: id } },
    });
    return {
      sessionCount,
      transactionCount,
      ledgerEntryCount,
      accountsWithBalance,
      accountStatusHistoryCount,
    };
  }

  // Travar a linha do cliente até o fim da transação
  async lockById(id: string, client: DatabaseClient) {
    await client.$queryRaw`SELECT id FROM Customer WHERE id = ${id} FOR UPDATE`;
  }

  // Gravar nova senha de atendimento, desbloquear e registrar quem redefiniu
  updatePassword(
    id: string,
    data: { passwordHash: string; changedAt: Date; changedByUserId: string },
    client: DatabaseClient = prisma,
  ) {
    return client.customer.update({
      where: { id },
      data: {
        passwordHash: data.passwordHash,
        failedPasswordAttempts: 0,
        passwordLockedUntil: null,
        passwordChangedAt: data.changedAt,
        passwordChangedByUserId: data.changedByUserId,
      },
      select: { id: true },
    });
  }
}
