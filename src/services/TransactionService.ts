import { Prisma } from '../generated/prisma/client.ts';
import type { TransactionType } from '../generated/prisma/enums.ts';
import { prisma } from '../database/prisma.js';
import { AppError } from '../errors/AppError.js';
import { appErrors } from '../errors/appErrors.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { TransactionRepository } from '../repositories/TransactionRepository.js';
import { createFingerprint } from '../utils/idempotency.js';
import { parseCents } from '../utils/money.js';
import { maskAccountNumber, maskName } from '../utils/mask.js';

type OperationInput = {
  operatorUserId: string;
  serviceSessionId: string;
  type: TransactionType;
  transferType?: 'PIX' | 'TED' | 'INTERNAL' | undefined;
  amountCents: bigint;
  feeCents?: bigint | undefined;
  sourceAccountId?: string | undefined;
  destinationAccountId?: string | undefined;
  pixKeyUsed?: string | undefined;
  description?: string | undefined;
  idempotencyKey: string;
  fingerprintPayload: unknown;
};

type IdempotentOperationResult<T> = { result: T; replayed: boolean };

// Service de depósitos, saques, extrato e execução financeira idempotente
export class TransactionService {
  // Receber repositories de contas e de transações
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  // Recuperar resultado anterior ou rejeitar reutilização conflitante da chave
  async getIdempotentResult<T extends Record<string, unknown>>(
    operatorUserId: string,
    idempotencyKey: string,
    fingerprintPayload: unknown,
  ): Promise<IdempotentOperationResult<T> | null> {
    const previous = await this.transactionRepository.findIdempotent(
      operatorUserId,
      idempotencyKey,
    );
    if (!previous) return null;
    if (previous.requestFingerprint !== createFingerprint(fingerprintPayload))
      throw appErrors.idempotencyConflict();
    if (!previous.resultData)
      throw new AppError(409, 'OPERATION_IN_PROGRESS', 'Operação ainda está sendo processada.');
    return { result: previous.resultData as T, replayed: true };
  }

  // Executar uma operação com idempotência, auditoria e rollback integral
  async executeIdempotent<T extends Record<string, unknown>>(
    input: OperationInput,
    execute: (
      tx: Prisma.TransactionClient,
      transaction: { id: string; createdAt: Date },
    ) => Promise<T>,
  ): Promise<IdempotentOperationResult<T>> {
    // Ler a transação já gravada com a mesma chave de idempotência
    const readExisting = async (): Promise<IdempotentOperationResult<T> | null> => {
      return this.getIdempotentResult<T>(
        input.operatorUserId,
        input.idempotencyKey,
        input.fingerprintPayload,
      );
    };
    const requestFingerprint = createFingerprint(input.fingerprintPayload);

    const previous = await readExisting();
    if (previous) return previous;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            const transaction = await this.transactionRepository.create(
              {
                operatorUserId: input.operatorUserId,
                serviceSessionId: input.serviceSessionId,
                type: input.type,
                ...(input.transferType ? { transferType: input.transferType } : {}),
                amountCents: input.amountCents,
                feeCents: input.feeCents ?? 0n,
                ...(input.sourceAccountId ? { sourceAccountId: input.sourceAccountId } : {}),
                ...(input.destinationAccountId
                  ? { destinationAccountId: input.destinationAccountId }
                  : {}),
                ...(input.pixKeyUsed ? { pixKeyUsed: input.pixKeyUsed } : {}),
                ...(input.description ? { description: input.description } : {}),
                idempotencyKey: input.idempotencyKey,
                requestFingerprint,
              },
              tx,
            );
            const result = await execute(tx, {
              id: transaction.id,
              createdAt: transaction.createdAt,
            });
            const resultData = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
            await this.transactionRepository.updateResult(transaction.id, resultData, tx);
            return result;
          },
          { maxWait: 5_000, timeout: 15_000 },
        );
        return { result, replayed: false };
      } catch (error) {
        const stored = await readExisting();
        if (stored) return stored;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          if (attempt < 2) continue;
          throw new AppError(
            409,
            'CONCURRENT_OPERATION',
            'Não foi possível concluir a operação concorrente.',
          );
        }
        throw error;
      }
    }
    throw new AppError(
      409,
      'CONCURRENT_OPERATION',
      'Não foi possível concluir a operação concorrente.',
    );
  }

  // Depositar valor e registrar as duas partidas correspondentes no ledger
  async deposit(
    input: { accountId: string; amountCents: string; description?: string | undefined },
    context: {
      customerId: string;
      operatorUserId: string;
      serviceSessionId: string;
      idempotencyKey: string;
    },
  ) {
    const amountCents = parseCents(input.amountCents);
    const fingerprintPayload = { operation: 'DEPOSIT', input, customerId: context.customerId };
    const replay = await this.getIdempotentResult<Record<string, unknown>>(
      context.operatorUserId,
      context.idempotencyKey,
      fingerprintPayload,
    );
    if (replay) return replay;
    const account = await this.accountRepository.findByIdForCustomer(
      input.accountId,
      context.customerId,
    );
    if (!account) throw appErrors.notFound('Conta');
    if (account.status !== 'ACTIVE') throw appErrors.accountBlocked();
    const system = await this.accountRepository.findSystem();
    if (!system)
      throw new AppError(500, 'SYSTEM_ACCOUNT_MISSING', 'Conta de compensação não configurada.');
    return this.executeIdempotent(
      {
        operatorUserId: context.operatorUserId,
        serviceSessionId: context.serviceSessionId,
        type: 'DEPOSIT',
        amountCents,
        sourceAccountId: system.id,
        destinationAccountId: account.id,
        description: input.description,
        idempotencyKey: context.idempotencyKey,
        fingerprintPayload,
      },
      async (tx, transaction) => {
        if (!(await this.accountRepository.credit(account.id, amountCents, tx)))
          throw appErrors.accountBlocked();
        if (!(await this.accountRepository.debitSystem(system.id, amountCents, tx)))
          throw new AppError(
            500,
            'SYSTEM_ACCOUNT_MISSING',
            'Conta de compensação não configurada.',
          );
        await this.transactionRepository.createLedgerEntries(
          [
            {
              transactionId: transaction.id,
              accountId: system.id,
              direction: 'DEBIT',
              amountCents,
            },
            {
              transactionId: transaction.id,
              accountId: account.id,
              direction: 'CREDIT',
              amountCents,
            },
          ],
          tx,
        );
        return {
          id: transaction.id,
          type: 'DEPOSIT',
          amountCents: amountCents.toString(),
          feeCents: '0',
          accountId: account.id,
          createdAt: transaction.createdAt.toISOString(),
        };
      },
    );
  }

  // Sacar valor e registrar as duas partidas correspondentes no ledger
  async withdraw(
    input: { accountId: string; amountCents: string; description?: string | undefined },
    context: {
      customerId: string;
      operatorUserId: string;
      serviceSessionId: string;
      idempotencyKey: string;
    },
  ) {
    const amountCents = parseCents(input.amountCents);
    const fingerprintPayload = { operation: 'WITHDRAWAL', input, customerId: context.customerId };
    const replay = await this.getIdempotentResult<Record<string, unknown>>(
      context.operatorUserId,
      context.idempotencyKey,
      fingerprintPayload,
    );
    if (replay) return replay;
    const account = await this.accountRepository.findByIdForCustomer(
      input.accountId,
      context.customerId,
    );
    if (!account) throw appErrors.notFound('Conta');
    if (account.status !== 'ACTIVE') throw appErrors.accountBlocked();
    const system = await this.accountRepository.findSystem();
    if (!system)
      throw new AppError(500, 'SYSTEM_ACCOUNT_MISSING', 'Conta de compensação não configurada.');
    return this.executeIdempotent(
      {
        operatorUserId: context.operatorUserId,
        serviceSessionId: context.serviceSessionId,
        type: 'WITHDRAWAL',
        amountCents,
        sourceAccountId: account.id,
        destinationAccountId: system.id,
        description: input.description,
        idempotencyKey: context.idempotencyKey,
        fingerprintPayload,
      },
      async (tx, transaction) => {
        if (!(await this.accountRepository.debit(account.id, amountCents, tx)))
          throw appErrors.insufficientFunds();
        if (!(await this.accountRepository.credit(system.id, amountCents, tx)))
          throw new AppError(
            500,
            'SYSTEM_ACCOUNT_MISSING',
            'Conta de compensação não configurada.',
          );
        await this.transactionRepository.createLedgerEntries(
          [
            {
              transactionId: transaction.id,
              accountId: account.id,
              direction: 'DEBIT',
              amountCents,
            },
            {
              transactionId: transaction.id,
              accountId: system.id,
              direction: 'CREDIT',
              amountCents,
            },
          ],
          tx,
        );
        return {
          id: transaction.id,
          type: 'WITHDRAWAL',
          amountCents: amountCents.toString(),
          feeCents: '0',
          accountId: account.id,
          createdAt: transaction.createdAt.toISOString(),
        };
      },
    );
  }

  // Consultar o extrato mantendo o isolamento do cliente atendido
  async getStatement(
    input: {
      page: number;
      pageSize: number;
      from?: string | undefined;
      to?: string | undefined;
      type?: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | undefined;
      transferType?: 'PIX' | 'TED' | 'INTERNAL' | undefined;
    },
    accountId: string,
    customerId: string,
  ) {
    const account = await this.accountRepository.findByIdForCustomer(accountId, customerId);
    if (!account) throw appErrors.notFound('Conta');
    const filters = {
      accountId,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
      type: input.type,
      transferType: input.transferType,
    };
    const countFilters = {
      accountId,
      from: filters.from,
      to: filters.to,
      type: filters.type,
      transferType: filters.transferType,
    };
    const [data, total] = await Promise.all([
      this.transactionRepository.findStatement(filters),
      this.transactionRepository.countStatement(countFilters),
    ]);
    return {
      data: data.map((transaction) => {
        const isSource = transaction.sourceAccountId === accountId;
        const counterpartyAccount = isSource
          ? transaction.destinationAccount
          : transaction.sourceAccount;
        return {
          id: transaction.id,
          type: transaction.type,
          transferType: transaction.transferType,
          direction: isSource ? 'DEBIT' : 'CREDIT',
          amountCents: transaction.amountCents.toString(),
          feeCents: transaction.feeCents.toString(),
          counterparty: counterpartyAccount
            ? {
                agency: counterpartyAccount.agency,
                number: maskAccountNumber(counterpartyAccount.number),
                name: maskName(counterpartyAccount.customer?.name ?? 'Conta do banco'),
              }
            : null,
          operator: transaction.operator,
          createdAt: transaction.createdAt.toISOString(),
        };
      }),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }
}
