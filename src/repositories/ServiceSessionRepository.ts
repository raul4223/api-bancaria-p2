import { prisma } from '../database/prisma.js';
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

  // Acrescentar tentativa inválida e aplicar bloqueio temporário
  async incrementFailedAttempts(
    customerId: string,
    maxAttempts: number,
    lockMinutes: number,
  ): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
      const nextAttempts = customer.failedPasswordAttempts + 1;
      await tx.customer.update({
        where: { id: customerId },
        data: {
          failedPasswordAttempts: nextAttempts,
          passwordLockedUntil:
            nextAttempts >= maxAttempts ? new Date(Date.now() + lockMinutes * 60_000) : null,
        },
      });
      return nextAttempts;
    });
  }

  // Zerar tentativas inválidas depois de uma senha correta
  resetFailedAttempts(customerId: string) {
    return prisma.customer.update({
      where: { id: customerId },
      data: { failedPasswordAttempts: 0, passwordLockedUntil: null },
    });
  }
}
