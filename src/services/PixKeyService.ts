import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.ts';
import { appErrors } from '../errors/appErrors.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { CustomerRepository } from '../repositories/CustomerRepository.js';
import { PixKeyRepository } from '../repositories/PixKeyRepository.js';
import { isValidPixEmail, isValidPixPhone, normalizePixKey } from '../utils/pixKey.js';
import { env } from '../config/env.js';
import { customerAgency } from '../utils/bankAccount.js';

// Service que valida, move e remove chaves Pix do cliente atendido
export class PixKeyService {
  // Receber repositories de clientes, contas e chaves Pix
  constructor(
    private readonly pixKeyRepository: PixKeyRepository,
    private readonly accountRepository: AccountRepository,
    private readonly customerRepository: CustomerRepository,
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
    if (input.keyType === 'PHONE' && (!keyValue || !isValidPixPhone(keyValue)))
      throw appErrors.validation();
    if (!keyValue) throw appErrors.validation();
    if (
      (await this.pixKeyRepository.countByAccount(account.id, customerId)) >= env.pixKeysPerAccount
    )
      throw appErrors.pixKeyLimit();

    try {
      return await this.pixKeyRepository.create({
        customerId,
        accountId: account.id,
        keyType: input.keyType,
        keyValue,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw appErrors.pixKeyConflict();
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
    await this.getById(id, customerId);
    const account = await this.accountRepository.findByNumberForCustomer(
      customerAgency,
      input.accountNumber,
      customerId,
    );
    if (!account) throw appErrors.notFound('Conta');
    if (account.status !== 'ACTIVE') throw appErrors.accountBlocked();
    if (
      account.id !== (await this.getById(id, customerId)).accountId &&
      (await this.pixKeyRepository.countByAccount(account.id, customerId)) >= env.pixKeysPerAccount
    )
      throw appErrors.pixKeyLimit();
    const result = await this.pixKeyRepository.update(id, customerId, account.id);
    if (result.count === 0) throw appErrors.notFound('Chave Pix');
    return this.getById(id, customerId);
  }

  // Excluir chave Pix sem modificar transações anteriores
  async delete(id: string, customerId: string): Promise<void> {
    const result = await this.pixKeyRepository.delete(id, customerId);
    if (result.count === 0) throw appErrors.notFound('Chave Pix');
  }
}
