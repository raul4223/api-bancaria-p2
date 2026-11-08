import { randomInt } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.ts';
import { appErrors } from '../errors/appErrors.js';
import { AccountRepository } from '../repositories/AccountRepository.js';

// Service que abre e consulta contas do cliente em atendimento
export class AccountService {
  // Receber o repository de contas
  constructor(private readonly accountRepository: AccountRepository) {}

  // Abrir conta corrente ou poupança com saldo inicial zero
  async open(input: { type: 'CHECKING' | 'SAVINGS' }, customerId: string) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const number = String(randomInt(1_000_000, 9_999_999));
      try {
        return await this.accountRepository.create({ customerId, agency: '0001', number, type: input.type, balanceCents: 0n });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        if (attempt === 3) throw error;
      }
    }
    throw new Error('Não foi possível gerar número de conta.');
  }

  // Listar contas do cliente atendido com paginação
  async list(input: { page: number; pageSize: number }, customerId: string) {
    const [data, total] = await Promise.all([
      this.accountRepository.findMany(customerId, (input.page - 1) * input.pageSize, input.pageSize),
      this.accountRepository.count(customerId),
    ]);
    return { data, page: input.page, pageSize: input.pageSize, total };
  }

  // Buscar conta apenas quando pertence ao cliente do atendimento
  async getById(accountId: string, customerId: string) {
    const account = await this.accountRepository.findByIdForCustomer(accountId, customerId);
    if (!account) throw appErrors.notFound('Conta');
    return { ...account, balanceCents: account.balanceCents.toString() };
  }

  // Bloquear ou desbloquear conta geral com auditoria do operador
  async changeStatus(accountId: string, input: { status: 'BLOCKED'; reason: string } | { status: 'ACTIVE' }, operatorUserId: string) {
    const account = await this.accountRepository.findById(accountId);
    if (!account || account.type === 'SYSTEM') throw appErrors.notFound('Conta');
    const data = input.status === 'BLOCKED'
      ? { status: 'BLOCKED' as const, blockReason: input.reason, blockedAt: new Date(), blockedByUserId: operatorUserId }
      : { status: 'ACTIVE' as const, blockReason: null, blockedAt: null, blockedByUserId: null };
    const updated = await this.accountRepository.updateStatus(accountId, data);
    return { ...updated, balanceCents: updated.balanceCents.toString() };
  }
}
