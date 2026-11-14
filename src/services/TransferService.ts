import { AppError } from '../errors/AppError.js';
import { appErrors } from '../errors/appErrors.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { BeneficiaryRepository } from '../repositories/BeneficiaryRepository.js';
import { PixKeyRepository } from '../repositories/PixKeyRepository.js';
import { TransactionRepository } from '../repositories/TransactionRepository.js';
import { TransactionService } from './TransactionService.js';
import { getTransferRule } from './transfer-rules/getTransferRule.js';
import type { Clock } from '../utils/clock.js';
import { systemClock } from '../utils/clock.js';
import { parseCents } from '../utils/money.js';
import { normalizePixKey } from '../utils/pixKey.js';
import { maskAccountNumber, maskName } from '../utils/mask.js';
import { customerAgency } from '../utils/bankAccount.js';

type TransferInput =
  | {
      transferType: 'PIX';
      sourceAccountNumber: string;
      amountCents: string;
      pixKey: string;
      description?: string | undefined;
    }
  | {
      transferType: 'TED';
      sourceAccountNumber: string;
      amountCents: string;
      destinationAgency: string;
      destinationAccountNumber: string;
      description?: string | undefined;
    }
  | {
      transferType: 'INTERNAL';
      sourceAccountNumber: string;
      destinationAccountNumber: string;
      amountCents: string;
      description?: string | undefined;
    }
  | {
      transferType: 'BENEFICIARY';
      sourceAccountNumber: string;
      beneficiaryId: string;
      amountCents: string;
      description?: string | undefined;
    };

type DirectTransferInput = Exclude<TransferInput, { transferType: 'BENEFICIARY' }>;

type TransferContext = {
  customerId: string;
  operatorUserId: string;
  serviceSessionId: string;
  idempotencyKey: string;
};

// Service do endpoint complexo de transferências simuladas
export class TransferService {
  // Receber repositories, serviço financeiro e relógio bancário
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly pixKeyRepository: PixKeyRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly transactionService: TransactionService,
    private readonly beneficiaryRepository: BeneficiaryRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  // Resolver, validar e registrar uma transferência atômica
  async transfer(input: TransferInput, context: TransferContext) {
    const amountCents = parseCents(input.amountCents);
    const fingerprintPayload = { operation: 'TRANSFER', input, customerId: context.customerId };
    const replay = await this.transactionService.getIdempotentResult<Record<string, unknown>>(
      context.operatorUserId,
      context.idempotencyKey,
      fingerprintPayload,
    );
    if (replay) return replay;
    const resolved =
      input.transferType === 'BENEFICIARY'
        ? await this.resolveBeneficiary(input, context.customerId)
        : input;
    const source = await this.accountRepository.findByNumberForCustomer(
      customerAgency,
      resolved.sourceAccountNumber,
      context.customerId,
    );
    if (!source) throw appErrors.notFound('Conta de origem');
    if (source.status !== 'ACTIVE') throw appErrors.accountBlocked();

    const destination = await this.resolveDestination(resolved);
    if (!destination.customerId || destination.type === 'SYSTEM')
      throw appErrors.destinationNotFound();
    if (destination.id === source.id) throw appErrors.sameAccount();
    if (destination.status !== 'ACTIVE') throw appErrors.accountBlocked();

    const rule = getTransferRule(resolved.transferType, this.clock);
    const transferContext = {
      transferType: resolved.transferType,
      amountCents,
      sourceCustomerId: context.customerId,
      destinationCustomerId: destination.customerId,
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
    };
    rule.validate(transferContext);
    const feeCents = rule.calculateFee(amountCents);
    const pixKeyUsed =
      resolved.transferType === 'PIX' ? normalizePixKey(resolved.pixKey) : undefined;

    return this.transactionService.executeIdempotent(
      {
        operatorUserId: context.operatorUserId,
        serviceSessionId: context.serviceSessionId,
        type: 'TRANSFER',
        transferType: resolved.transferType,
        amountCents,
        feeCents,
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        ...(pixKeyUsed ? { pixKeyUsed } : {}),
        ...(resolved.description ? { description: resolved.description } : {}),
        idempotencyKey: context.idempotencyKey,
        fingerprintPayload,
      },
      async (tx, transaction) => {
        const [currentSource, currentDestination] = await Promise.all([
          this.accountRepository.findById(source.id, tx),
          this.accountRepository.findById(destination.id, tx),
        ]);
        if (!currentSource || currentSource.customerId !== context.customerId)
          throw appErrors.notFound('Conta de origem');
        if (
          !currentDestination ||
          currentDestination.type === 'SYSTEM' ||
          !currentDestination.customerId
        )
          throw appErrors.destinationNotFound();
        if (currentSource.status !== 'ACTIVE' || currentDestination.status !== 'ACTIVE')
          throw appErrors.accountBlocked();
        if (resolved.transferType === 'PIX') {
          const currentKey = await this.pixKeyRepository.findByValue(
            normalizePixKey(resolved.pixKey),
            tx,
          );
          if (!currentKey || currentKey.accountId !== currentDestination.id)
            throw appErrors.pixKeyNotFound();
        }
        rule.validate({ ...transferContext, destinationCustomerId: currentDestination.customerId });

        const totalDebit = amountCents + feeCents;
        if (!(await this.accountRepository.debit(currentSource.id, totalDebit, tx)))
          throw appErrors.insufficientFunds();
        if (!(await this.accountRepository.credit(currentDestination.id, amountCents, tx)))
          throw appErrors.accountBlocked();

        const ledgerEntries = [
          {
            transactionId: transaction.id,
            accountId: currentSource.id,
            direction: 'DEBIT' as const,
            amountCents: totalDebit,
          },
          {
            transactionId: transaction.id,
            accountId: currentDestination.id,
            direction: 'CREDIT' as const,
            amountCents,
          },
        ];

        if (feeCents > 0n) {
          const system = await this.accountRepository.findSystem(tx);
          if (!system)
            throw new AppError(
              500,
              'SYSTEM_ACCOUNT_MISSING',
              'Conta de compensação não configurada.',
            );
          if (!(await this.accountRepository.credit(system.id, feeCents, tx)))
            throw new AppError(
              500,
              'SYSTEM_ACCOUNT_MISSING',
              'Conta de compensação não configurada.',
            );
          ledgerEntries.push({
            transactionId: transaction.id,
            accountId: system.id,
            direction: 'CREDIT',
            amountCents: feeCents,
          });
        }
        await this.transactionRepository.createLedgerEntries(ledgerEntries, tx);

        return {
          id: transaction.id,
          type: 'TRANSFER',
          transferType: resolved.transferType,
          amountCents: amountCents.toString(),
          feeCents: feeCents.toString(),
          sourceAccount: { agency: currentSource.agency, number: currentSource.number },
          destination: {
            agency: currentDestination.agency,
            number: maskAccountNumber(currentDestination.number),
            name: maskName(currentDestination.customer?.name ?? 'Cliente'),
          },
          createdAt: transaction.createdAt.toISOString(),
        };
      },
    );
  }

  // Converter o favorecido do cliente atendido no destino PIX ou TED salvo
  private async resolveBeneficiary(
    input: Extract<TransferInput, { transferType: 'BENEFICIARY' }>,
    customerId: string,
  ): Promise<DirectTransferInput> {
    const beneficiary = await this.beneficiaryRepository.findById(input.beneficiaryId, customerId);
    if (!beneficiary) throw appErrors.notFound('Favorecido');
    const base = {
      sourceAccountNumber: input.sourceAccountNumber,
      amountCents: input.amountCents,
      ...(input.description ? { description: input.description } : {}),
    };
    if (beneficiary.transferType === 'PIX' && beneficiary.pixKey)
      return { ...base, transferType: 'PIX', pixKey: beneficiary.pixKey };
    if (
      beneficiary.transferType === 'TED' &&
      beneficiary.destinationAgency &&
      beneficiary.destinationAccountNumber
    )
      return {
        ...base,
        transferType: 'TED',
        destinationAgency: beneficiary.destinationAgency,
        destinationAccountNumber: beneficiary.destinationAccountNumber,
      };
    throw appErrors.validation();
  }

  // Resolver destino Pix, TED ou interno sem expor conta SYSTEM
  private async resolveDestination(input: DirectTransferInput) {
    if (input.transferType === 'PIX') {
      const key = await this.pixKeyRepository.findByValue(normalizePixKey(input.pixKey));
      if (!key) throw appErrors.pixKeyNotFound();
      return key.account;
    }
    if (input.transferType === 'TED') {
      const account = await this.accountRepository.findByNumber(
        input.destinationAgency,
        input.destinationAccountNumber,
      );
      if (!account) throw appErrors.destinationNotFound();
      return account;
    }
    const account = await this.accountRepository.findByNumber(
      customerAgency,
      input.destinationAccountNumber,
    );
    if (!account) throw appErrors.destinationNotFound();
    return account;
  }
}
