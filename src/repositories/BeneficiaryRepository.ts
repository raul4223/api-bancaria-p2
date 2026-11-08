import { prisma } from '../database/prisma.js';
import type { Prisma } from '../generated/prisma/client.ts';

// Repository que acessa a agenda de favorecidos dos clientes
export class BeneficiaryRepository {
  // Criar favorecido na agenda do cliente atendido
  create(data: Prisma.BeneficiaryUncheckedCreateInput) {
    return prisma.beneficiary.create({ data });
  }

  // Listar favorecidos paginados do cliente atendido
  findMany(customerId: string, skip: number, take: number) {
    return prisma.beneficiary.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, skip, take });
  }

  // Contar favorecidos do cliente para paginação
  count(customerId: string) {
    return prisma.beneficiary.count({ where: { customerId } });
  }

  // Buscar favorecido somente dentro da agenda do cliente
  findById(id: string, customerId: string) {
    return prisma.beneficiary.findFirst({ where: { id, customerId } });
  }

  // Atualizar favorecido somente dentro da agenda do cliente
  update(id: string, customerId: string, data: Prisma.BeneficiaryUpdateManyMutationInput) {
    return prisma.beneficiary.updateMany({ where: { id, customerId }, data });
  }

  // Excluir favorecido sem tocar no histórico de transações
  delete(id: string, customerId: string) {
    return prisma.beneficiary.deleteMany({ where: { id, customerId } });
  }
}
