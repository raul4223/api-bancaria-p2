import { prisma } from '../database/prisma.js';
import type { Prisma } from '../generated/prisma/client.ts';

// Repository que acessa a tabela de clientes
export class CustomerRepository {
  // Criar cliente com senha já protegida por hash
  create(data: Prisma.CustomerUncheckedCreateInput) {
    return prisma.customer.create({ data });
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

  // Excluir cliente somente depois de validar seu histórico no service
  delete(id: string) {
    return prisma.customer.delete({ where: { id } });
  }

  // Verificar contas e atendimentos antes da exclusão física
  async hasHistory(id: string): Promise<boolean> {
    const [accountCount, sessionCount] = await Promise.all([
      prisma.account.count({ where: { customerId: id } }),
      prisma.serviceSession.count({ where: { customerId: id } }),
    ]);
    return accountCount > 0 || sessionCount > 0;
  }
}
