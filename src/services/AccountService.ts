import { randomInt } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.ts';
import { prisma } from '../database/prisma.js';
import { appErrors } from '../errors/appErrors.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { customerAgency } from '../utils/bankAccount.js';

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

// Service que abre e consulta contas de clientes
export class AccountService {
  // Receber o repository de contas
  constructor(private readonly accountRepository: AccountRepository) {}

  // Gerar um número de conta de 7 dígitos ainda não usado na agência
  private async generateNumber(client: DatabaseClient): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const number = String(randomInt(1_000_000, 10_000_000));
      if (!(await this.accountRepository.existsByNumber(customerAgency, number, client)))
        return number;
    }
    throw new Error('Não foi possível gerar número de conta.');
  }

  // Criar conta com saldo zero, dentro da transação recebida quando houver
  async createForCustomer(
    customerId: string,
    type: 'CHECKING' | 'SAVINGS',
    client: DatabaseClient = prisma,
  ) {
    const number = await this.generateNumber(client);
    return this.accountRepository.create(
      { customerId, agency: customerAgency, number, type, balanceCents: 0n },
      client,
    );
  }

  // Abrir conta adicional (corrente ou poupança) para o cliente atendido
  async open(input: { type: 'CHECKING' | 'SAVINGS' }, customerId: string) {
    return this.createForCustomer(customerId, input.type);
  }

  // Listar contas do cliente atendido com paginação
  async list(input: { page: number; pageSize: number }, customerId: string) {
    const [data, total] = await Promise.all([
      this.accountRepository.findMany(
        customerId,
        (input.page - 1) * input.pageSize,
        input.pageSize,
      ),
      this.accountRepository.count(customerId),
    ]);
    return { data, page: input.page, pageSize: input.pageSize, total };
  }

  // Buscar conta pelo número apenas quando pertence ao cliente do atendimento
  async getByNumber(accountNumber: string, customerId: string) {
    const account = await this.accountRepository.findByNumberForCustomer(
      customerAgency,
      accountNumber,
      customerId,
    );
    if (!account) throw appErrors.notFound('Conta');
    return { ...account, balanceCents: account.balanceCents.toString() };
  }

  // Bloquear ou desbloquear conta geral com auditoria do operador
  async changeStatus(
    accountNumber: string,
    input: { status: 'BLOCKED'; reason: string } | { status: 'ACTIVE' },
    operatorUserId: string,
  ) {
    const account = await this.accountRepository.findByNumber(customerAgency, accountNumber);
    if (!account || account.type === 'SYSTEM') throw appErrors.notFound('Conta');
    const data =
      input.status === 'BLOCKED'
        ? {
            status: 'BLOCKED' as const,
            blockReason: input.reason,
            blockedAt: new Date(),
            blockedByUserId: operatorUserId,
          }
        : { status: 'ACTIVE' as const, blockReason: null, blockedAt: null, blockedByUserId: null };
    const updated = await this.accountRepository.updateStatus(account.id, data);
    return { ...updated, balanceCents: updated.balanceCents.toString() };
  }
}
