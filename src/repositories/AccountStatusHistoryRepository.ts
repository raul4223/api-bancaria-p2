import { prisma } from '../database/prisma.js';
import type { DatabaseClient } from '../database/transactionManager.js';
import type { Prisma } from '../generated/prisma/client.ts';

// Repository que registra e consulta o histórico de bloqueio e desbloqueio de contas
export class AccountStatusHistoryRepository {
  // Gravar uma mudança de status da conta
  create(data: Prisma.AccountStatusHistoryUncheckedCreateInput, client: DatabaseClient = prisma) {
    return client.accountStatusHistory.create({ data });
  }

  // Listar mudanças de status da conta, da mais recente para a mais antiga
  findMany(accountId: string, skip: number, take: number) {
    return prisma.accountStatusHistory.findMany({
      where: { accountId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
      include: { operator: { select: { id: true, name: true } } },
    });
  }

  // Contar mudanças de status da conta para paginação
  count(accountId: string) {
    return prisma.accountStatusHistory.count({ where: { accountId } });
  }
}
