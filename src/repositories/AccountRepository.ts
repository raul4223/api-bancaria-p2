import { prisma } from '../database/prisma.js';
import type { Prisma } from '../generated/prisma/client.ts';

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

// Repository que consulta contas e atualiza saldos materializados
export class AccountRepository {
  // Criar conta com saldo inicial zerado
  create(data: Prisma.AccountUncheckedCreateInput) {
    return prisma.account.create({ data });
  }

  // Listar contas do cliente do atendimento
  findMany(customerId: string, skip: number, take: number) {
    return prisma.account.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  // Contar contas do cliente para paginação
  count(customerId: string) {
    return prisma.account.count({ where: { customerId } });
  }

  // Buscar conta por ID sem revelar contas de outros clientes
  findByIdForCustomer(id: string, customerId: string) {
    return prisma.account.findFirst({ where: { id, customerId } });
  }

  // Buscar conta pela agência e número sem revelar contas de outros clientes
  findByNumberForCustomer(agency: string, number: string, customerId: string) {
    return prisma.account.findFirst({ where: { agency, number, customerId } });
  }

  // Buscar conta por ID incluindo os dados do titular
  findById(id: string, client: DatabaseClient = prisma) {
    return client.account.findUnique({ where: { id }, include: { customer: true } });
  }

  // Buscar conta pela agência e número
  findByNumber(agency: string, number: string, client: DatabaseClient = prisma) {
    return client.account.findUnique({
      where: { agency_number: { agency, number } },
      include: { customer: true },
    });
  }

  // Debitar saldo somente se a conta ativa tiver fundos suficientes
  async debit(id: string, amountCents: bigint, client: DatabaseClient = prisma): Promise<boolean> {
    const result = await client.account.updateMany({
      where: { id, status: 'ACTIVE', balanceCents: { gte: amountCents } },
      data: { balanceCents: { decrement: amountCents } },
    });
    return result.count === 1;
  }

  // Debitar a conta SYSTEM que representa valores externos simulados
  async debitSystem(
    id: string,
    amountCents: bigint,
    client: DatabaseClient = prisma,
  ): Promise<boolean> {
    const result = await client.account.updateMany({
      where: { id, type: 'SYSTEM' },
      data: { balanceCents: { decrement: amountCents } },
    });
    return result.count === 1;
  }

  // Creditar saldo de uma conta ativa
  async credit(id: string, amountCents: bigint, client: DatabaseClient = prisma): Promise<boolean> {
    const result = await client.account.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { balanceCents: { increment: amountCents } },
    });
    return result.count === 1;
  }

  // Alterar bloqueio ou desbloqueio com registro do operador
  updateStatus(id: string, data: Prisma.AccountUpdateInput) {
    return prisma.account.update({ where: { id }, data });
  }

  // Localizar conta SYSTEM para registrar contrapartidas
  findSystem(client: DatabaseClient = prisma) {
    return client.account.findFirst({ where: { type: 'SYSTEM' } });
  }
}
