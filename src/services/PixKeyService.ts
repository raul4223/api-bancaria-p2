import { randomUUID } from 'node:crypto';
import { appErrors } from '../errors/appErrors.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { CustomerRepository } from '../repositories/CustomerRepository.js';
import { PixKeyRepository } from '../repositories/PixKeyRepository.js';
import { isValidPixEmail, normalizePixKey, toPixPhone } from '../utils/pixKey.js';
import { env } from '../config/env.js';
import { customerAgency } from '../utils/bankAccount.js';
import type { TransactionManager } from '../database/transactionManager.js';
import { isUniqueViolation } from '../database/prismaErrors.js';

// Service que valida, move e remove chaves Pix do cliente atendido
export class PixKeyService {
  // Receber repositories de clientes, contas e chaves Pix
  constructor(
    private readonly pixKeyRepository: PixKeyRepository,
    private readonly accountRepository: AccountRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  // Criar chave Pix validando titularidade e limite da conta
  async create(
    input: {
      accountNumber: string;
      keyType: 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM';
      keyValue?: string | undefined;
    },
    customerId: string,
  ) {
    const [customer, account] = await Promise.all([
      this.customerRepository.findById(customerId),
      this.accountRepository.findByNumberForCustomer(
        customerAgency,
        input.accountNumber,
        customerId,
      ),
    ]);
    if (!customer || !account) throw appErrors.notFound('Conta');
    if (account.status !== 'ACTIVE') throw appErrors.accountBlocked();

    let keyValue = input.keyValue ? normalizePixKey(input.keyValue) : '';
    if (input.keyType === 'RANDOM') keyValue = randomUUID();
    if (input.keyType === 'CPF') {
      keyValue = keyValue || customer.cpf;
      if (keyValue !== customer.cpf) throw appErrors.ownBeneficiary();
    }
    if (input.keyType === 'EMAIL' && (!keyValue || !isValidPixEmail(keyValue)))
      throw appErrors.validation();
    if (input.keyType === 'PHONE') {
      const phone = toPixPhone(input.keyValue ?? '');
      if (phone === null) throw appErrors.validation();
      keyValue = phone;
    }
    if (!keyValue) throw appErrors.validation();

    try {
      return await this.transactionManager.run(async (tx) => {
        await this.accountRepository.lockById(account.id, tx);
        if (
          (await this.pixKeyRepository.countByAccount(account.id, customerId, tx)) >=
          env.pixKeysPerAccount
        )
          throw appErrors.pixKeyLimit();
        return this.pixKeyRepository.create(
          { customerId, accountId: account.id, keyType: input.keyType, keyValue },
          tx,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw appErrors.pixKeyConflict();
      throw error;
    }
  }

  // Listar chaves Pix paginadas pertencentes ao atendimento
  async list(input: { page: number; pageSize: number }, customerId: string) {
    const [data, total] = await Promise.all([
      this.pixKeyRepository.findMany(customerId, (input.page - 1) * input.pageSize, input.pageSize),
      this.pixKeyRepository.count(customerId),
    ]);
    return { data, page: input.page, pageSize: input.pageSize, total };
  }

  // Buscar chave Pix somente na coleção do cliente atendido
  async getById(id: string, customerId: string) {
    const key = await this.pixKeyRepository.findById(id, customerId);
    if (!key) throw appErrors.notFound('Chave Pix');
    return key;
  }

  // Mover chave Pix para outra conta ativa do mesmo cliente
  async update(id: string, input: { accountNumber: string }, customerId: string) {
    const key = await this.getById(id, customerId);
    const account = await this.accountRepository.findByNumberForCustomer(
      customerAgency,
      input.accountNumber,
      customerId,
    );
    if (!account) throw appErrors.notFound('Conta');
    if (account.status !== 'ACTIVE') throw appErrors.accountBlocked();
    await this.transactionManager.run(async (tx) => {
      await this.accountRepository.lockById(account.id, tx);
      if (
        account.id !== key.accountId &&
        (await this.pixKeyRepository.countByAccount(account.id, customerId, tx)) >=
          env.pixKeysPerAccount
      )
        throw appErrors.pixKeyLimit();
      const result = await this.pixKeyRepository.update(id, customerId, account.id, tx);
      if (result.count === 0) throw appErrors.notFound('Chave Pix');
    });
    return this.getById(id, customerId);
  }

  // Excluir chave Pix sem modificar transações anteriores
  async delete(id: string, customerId: string): Promise<void> {
    const result = await this.pixKeyRepository.delete(id, customerId);
    if (result.count === 0) throw appErrors.notFound('Chave Pix');
  }
}
