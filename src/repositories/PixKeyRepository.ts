import { prisma } from '../database/prisma.js';
import type { Prisma } from '../generated/prisma/client.ts';

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

// Repository que acessa as chaves Pix registradas pelos clientes
export class PixKeyRepository {
  // Criar chave Pix associada ao cliente e à conta
  create(data: {
    customerId: string;
    accountId: string;
    keyType: 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM';
    keyValue: string;
  }) {
    return prisma.pixKey.create({ data });
  }

  // Listar chaves Pix do cliente do atendimento
  findMany(customerId: string, skip: number, take: number) {
    return prisma.pixKey.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  // Contar chaves Pix do cliente para paginação
  count(customerId: string) {
    return prisma.pixKey.count({ where: { customerId } });
  }

  // Buscar chave por ID sem expor registros de outro cliente
  findById(id: string, customerId: string) {
    return prisma.pixKey.findFirst({ where: { id, customerId } });
  }

  // Buscar chave pelo valor para resolver destino Pix
  findByValue(keyValue: string, client: DatabaseClient = prisma) {
    return client.pixKey.findUnique({
      where: { keyValue },
      include: { account: { include: { customer: true } } },
    });
  }

  // Contar chaves ligadas à conta do cliente
  countByAccount(accountId: string, customerId: string) {
    return prisma.pixKey.count({ where: { accountId, customerId } });
  }

  // Mover chave para outra conta do mesmo cliente atendido
  update(id: string, customerId: string, accountId: string) {
    return prisma.pixKey.updateMany({ where: { id, customerId }, data: { accountId } });
  }

  // Excluir chave pertencente ao cliente do atendimento
  delete(id: string, customerId: string) {
    return prisma.pixKey.deleteMany({ where: { id, customerId } });
  }
}
