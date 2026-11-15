import { prisma } from '../database/prisma.js';
import type { DatabaseClient } from '../database/transactionManager.js';
import type { Prisma } from '../generated/prisma/client.ts';

// Repository que registra atendimentos e tentativas de senha
export class ServiceSessionRepository {
  // Criar atendimento associado ao operador e ao cliente
  create(data: Prisma.ServiceSessionUncheckedCreateInput) {
    return prisma.serviceSession.create({ data, include: { customer: true } });
  }

  // Encerrar atendimentos abertos anteriores do mesmo operador
  closeOpenForOperator(operatorUserId: string, closedAt: Date) {
    return prisma.serviceSession.updateMany({
      where: { operatorUserId, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt },
    });
  }

  // Buscar atendimento válido por ID e operador
  findByIdForOperator(id: string, operatorUserId: string) {
    return prisma.serviceSession.findFirst({
      where: { id, operatorUserId },
      include: { customer: true },
    });
  }

  // Fechar atendimento que pertence ao operador autenticado
  close(id: string, operatorUserId: string, closedAt: Date) {
    return prisma.serviceSession.updateMany({
      where: { id, operatorUserId, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt },
    });
  }

  // Gravar expiração de atendimento após seu prazo
  expire(id: string) {
    return prisma.serviceSession.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'EXPIRED' },
    });
  }

  // Registrar tentativa inválida de forma atômica e bloquear ao atingir o limite
  async incrementFailedAttempts(
    customerId: string,
    now: Date,
    maxAttempts: number,
    lockMinutes: number,
  ): Promise<number> {
    return prisma.$transaction(async (tx) => {
      // Recomeçar a contagem quando o bloqueio anterior já venceu
      await tx.customer.updateMany({
        where: { id: customerId, passwordLockedUntil: { lte: now } },
        data: { failedPasswordAttempts: 0, passwordLockedUntil: null },
      });
      // O incremento relativo trava a linha e evita perder tentativas simultâneas
      const customer = await tx.customer.update({
        where: { id: customerId },
        data: { failedPasswordAttempts: { increment: 1 } },
        select: { failedPasswordAttempts: true },
      });
      if (customer.failedPasswordAttempts >= maxAttempts) {
        await tx.customer.update({
          where: { id: customerId },
          data: { passwordLockedUntil: new Date(now.getTime() + lockMinutes * 60_000) },
        });
      }
      return customer.failedPasswordAttempts;
    });
  }

  // Zerar tentativas inválidas depois de uma senha correta
  resetFailedAttempts(customerId: string) {
    return prisma.customer.update({
      where: { id: customerId },
      data: { failedPasswordAttempts: 0, passwordLockedUntil: null },
    });
  }

  // Buscar o atendimento aberto mais recente do operador
  findOpenForOperator(operatorUserId: string) {
    return prisma.serviceSession.findFirst({
      where: { operatorUserId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
      include: { customer: true },
    });
  }

  // Encerrar todos os atendimentos abertos de um cliente
  closeOpenForCustomer(customerId: string, closedAt: Date, client: DatabaseClient = prisma) {
    return client.serviceSession.updateMany({
      where: { customerId, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt },
    });
  }
}
