import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/database/prisma.js';
import { AccountRepository } from '../../src/repositories/AccountRepository.js';
import { TransactionRepository } from '../../src/repositories/TransactionRepository.js';
import { TransactionManager } from '../../src/database/transactionManager.js';
import { TransactionService } from '../../src/services/TransactionService.js';
import {
  apiBase,
  createCustomer,
  get,
  openAccount,
  openSession,
  patch,
  post,
  remove,
  setupTestDatabase,
} from './helpers.js';

const cpfA = '52998224725';
let customerAId = '';
let accountA1Id = '';
let accountA2Id = '';
let accountB1Id = '';
let accountA1Number = '';
let accountA2Number = '';
let accountB1Number = '';
let serviceSessionAId = '';
let pixKeyB = '';
let tedId = '';

beforeAll(async () => {
  await setupTestDatabase();
  const customerA = await createCustomer({
    name: 'Cliente A',
    cpf: cpfA,
    email: 'a@example.test',
    customerPassword: '291847',
  });
  const customerB = await createCustomer({
    name: 'Cliente B',
    cpf: '11144477735',
    email: 'b@example.test',
    customerPassword: '847291',
  });
  customerAId = customerA.id;
  ({ accountId: accountA1Id, accountNumber: accountA1Number } = customerA);
  ({ accountId: accountB1Id, accountNumber: accountB1Number } = customerB);
  const serviceSessionBId = await openSession('11144477735', '847291');
  const createPix = await post(
    `${apiBase}/customer-service/pix-keys`,
    { accountNumber: accountB1Number, keyType: 'EMAIL', keyValue: 'b@example.test' },
    serviceSessionBId,
  );
  expect(createPix.status).toBe(201);
  pixKeyB = createPix.body.keyValue as string;
  serviceSessionAId = await openSession(cpfA, '291847');
  ({ id: accountA2Id, number: accountA2Number } = await openAccount(serviceSessionAId, 'SAVINGS'));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('depósitos, saques e transferências', () => {
  it('exige atendimento para depositar', async () => {
    const noSession = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountNumber: accountA1Number, amountCents: '10000' },
      undefined,
      randomUUID(),
    );
    expect(noSession.status).toBe(401);
  });

  it('deposita e repete o resultado com a mesma Idempotency-Key, recusando corpo diferente', async () => {
    const depositKey = randomUUID();
    const deposit = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountNumber: accountA1Number, amountCents: '10000' },
      serviceSessionAId,
      depositKey,
    );
    expect(deposit.status).toBe(201);
    const repeatedDeposit = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountNumber: accountA1Number, amountCents: '10000' },
      serviceSessionAId,
      depositKey,
    );
    expect(repeatedDeposit.status).toBe(200);
    expect(repeatedDeposit.body.id).toBe(deposit.body.id);
    const conflictingDeposit = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountNumber: accountA1Number, amountCents: '9000' },
      serviceSessionAId,
      depositKey,
    );
    expect(conflictingDeposit.status).toBe(409);
  });

  it('transfere INTERNAL entre contas do cliente com idempotência', async () => {
    const internalKey = randomUUID();
    const internal = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'INTERNAL',
        sourceAccountNumber: accountA1Number,
        destinationAccountNumber: accountA2Number,
        amountCents: '1000',
      },
      serviceSessionAId,
      internalKey,
    );
    expect(internal.status).toBe(201);
    const repeatedInternal = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'INTERNAL',
        sourceAccountNumber: accountA1Number,
        destinationAccountNumber: accountA2Number,
        amountCents: '1000',
      },
      serviceSessionAId,
      internalKey,
    );
    expect(repeatedInternal.status).toBe(200);
    expect(repeatedInternal.body.id).toBe(internal.body.id);
  });

  it('transfere PIX para a chave de outro cliente', async () => {
    const pix = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'PIX',
        sourceAccountNumber: accountA1Number,
        amountCents: '3000',
        pixKey: pixKeyB,
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(pix.status).toBe(201);
    expect(pix.body.transferType).toBe('PIX');
  });

  it('transfere TED com tarifa', async () => {
    const b1Number = (await prisma.account.findUniqueOrThrow({ where: { id: accountB1Id } }))
      .number;
    const ted = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'TED',
        sourceAccountNumber: accountA1Number,
        amountCents: '2000',
        destinationAgency: '0001',
        destinationAccountNumber: b1Number,
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(ted.status).toBe(201);
    expect(ted.body.feeCents).toBe('500');
    tedId = ted.body.id as string;
  });

  it('saca e confere os saldos e a contrapartida da SYSTEM', async () => {
    const withdrawal = await post(
      `${apiBase}/customer-service/transactions/withdrawals`,
      { accountNumber: accountA1Number, amountCents: '500' },
      serviceSessionAId,
      randomUUID(),
    );
    expect(withdrawal.status).toBe(201);
    const afterScenario = await Promise.all([
      prisma.account.findUniqueOrThrow({ where: { id: accountA1Id } }),
      prisma.account.findUniqueOrThrow({ where: { id: accountA2Id } }),
      prisma.account.findUniqueOrThrow({ where: { id: accountB1Id } }),
      prisma.account.findFirstOrThrow({ where: { type: 'SYSTEM' } }),
    ]);
    expect(afterScenario.map((account) => account.balanceCents.toString())).toEqual([
      '3000',
      '1000',
      '5000',
      '-9000',
    ]);
  });

  it('recusa saque sem saldo e valor zero', async () => {
    const insufficient = await post(
      `${apiBase}/customer-service/transactions/withdrawals`,
      { accountNumber: accountA1Number, amountCents: '99999' },
      serviceSessionAId,
      randomUUID(),
    );
    expect(insufficient.status).toBe(422);
    const invalidAmount = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountNumber: accountA1Number, amountCents: '0' },
      serviceSessionAId,
      randomUUID(),
    );
    expect(invalidAmount.status).toBe(422);
  });

  it('responde 404 para chave Pix inexistente', async () => {
    const missingPix = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'PIX',
        sourceAccountNumber: accountA1Number,
        amountCents: '100',
        pixKey: 'inexistente@example.test',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(missingPix.status).toBe(404);
  });

  it('recusa INTERNAL para a mesma conta', async () => {
    const sameAccountTransfer = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'INTERNAL',
        sourceAccountNumber: accountA1Number,
        destinationAccountNumber: accountA1Number,
        amountCents: '100',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(sameAccountTransfer.status).toBe(422);
  });

  it('recusa INTERNAL para conta de outro cliente', async () => {
    const crossCustomerInternal = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'INTERNAL',
        sourceAccountNumber: accountA1Number,
        destinationAccountNumber: accountB1Number,
        amountCents: '100',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(crossCustomerInternal.status).toBe(422);
  });

  it('responde 404 para origem de outro cliente', async () => {
    const otherCustomersSource = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'INTERNAL',
        sourceAccountNumber: accountB1Number,
        destinationAccountNumber: accountA1Number,
        amountCents: '100',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(otherCustomersSource.status).toBe(404);
  });

  it('recusa TED quando falta saldo só para a tarifa', async () => {
    const feeOnlyShortfall = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'TED',
        sourceAccountNumber: accountA1Number,
        amountCents: '2600',
        destinationAgency: '0001',
        destinationAccountNumber: (
          await prisma.account.findUniqueOrThrow({ where: { id: accountB1Id } })
        ).number,
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(feeOnlyShortfall.status).toBe(422);
  });

  it('responde DESTINATION_UNAVAILABLE para destino bloqueado de outro cliente', async () => {
    expect(
      (
        await patch(`${apiBase}/accounts/${accountB1Number}/status`, {
          status: 'BLOCKED',
          reason: 'Teste de bloqueio de destino',
        })
      ).status,
    ).toBe(200);
    const blockedDestination = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'PIX',
        sourceAccountNumber: accountA1Number,
        amountCents: '100',
        pixKey: pixKeyB,
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(blockedDestination.status).toBe(422);
    expect(blockedDestination.body.error.code).toBe('DESTINATION_UNAVAILABLE');
    expect(
      (await patch(`${apiBase}/accounts/${accountB1Number}/status`, { status: 'ACTIVE' })).status,
    ).toBe(200);
  });

  it('recusa saque de conta de origem bloqueada', async () => {
    expect(
      (
        await patch(`${apiBase}/accounts/${accountA1Number}/status`, {
          status: 'BLOCKED',
          reason: 'Teste de bloqueio de origem',
        })
      ).status,
    ).toBe(200);
    const blockedSource = await post(
      `${apiBase}/customer-service/transactions/withdrawals`,
      {
        accountNumber: accountA1Number,
        amountCents: '100',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(blockedSource.status).toBe(422);
    expect(
      (await patch(`${apiBase}/accounts/${accountA1Number}/status`, { status: 'ACTIVE' })).status,
    ).toBe(200);
  });

  it('aceita só um de dois saques simultâneos que excedem o saldo', async () => {
    const concurrent = await Promise.all([
      post(
        `${apiBase}/customer-service/transactions/withdrawals`,
        { accountNumber: accountA1Number, amountCents: '2000' },
        serviceSessionAId,
        randomUUID(),
      ),
      post(
        `${apiBase}/customer-service/transactions/withdrawals`,
        { accountNumber: accountA1Number, amountCents: '2000' },
        serviceSessionAId,
        randomUUID(),
      ),
    ]);
    expect(concurrent.filter((response) => response.status === 201)).toHaveLength(1);
    expect(
      concurrent.filter((response) => response.status === 422),
      JSON.stringify(
        concurrent.map((response) => ({ status: response.status, body: response.body })),
      ),
    ).toHaveLength(1);
  });

  it('grava uma vez só dois depósitos simultâneos com a mesma chave', async () => {
    const balanceBeforeDuplicate = (
      await prisma.account.findUniqueOrThrow({ where: { id: accountA1Id } })
    ).balanceCents;
    const duplicateKey = randomUUID();
    const simultaneousDuplicates = await Promise.all([
      post(
        `${apiBase}/customer-service/transactions/deposits`,
        { accountNumber: accountA1Number, amountCents: '100' },
        serviceSessionAId,
        duplicateKey,
      ),
      post(
        `${apiBase}/customer-service/transactions/deposits`,
        { accountNumber: accountA1Number, amountCents: '100' },
        serviceSessionAId,
        duplicateKey,
      ),
    ]);
    expect(simultaneousDuplicates.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(simultaneousDuplicates[0].body.id).toBe(simultaneousDuplicates[1].body.id);
    const balanceAfterDuplicate = (
      await prisma.account.findUniqueOrThrow({ where: { id: accountA1Id } })
    ).balanceCents;
    expect(balanceAfterDuplicate - balanceBeforeDuplicate).toBe(100n);
    expect(
      (await prisma.account.findFirstOrThrow({ where: { type: 'SYSTEM' } })).balanceCents,
    ).toBeLessThan(0n);
  });

  it('desfaz saldos e transação quando a gravação do ledger falha', async () => {
    const operatorId = (
      await prisma.user.findUniqueOrThrow({ where: { email: 'operator@example.test' } })
    ).id;
    const rollbackKey = randomUUID();
    const balanceBeforeRollback = (
      await prisma.account.findUniqueOrThrow({ where: { id: accountA1Id } })
    ).balanceCents;
    const systemBeforeRollback = (
      await prisma.account.findFirstOrThrow({ where: { type: 'SYSTEM' } })
    ).balanceCents;
    const failingLedgerRepository = new TransactionRepository();
    // Interromper a gravação do ledger depois dos updates de saldo
    failingLedgerRepository.createLedgerEntries = () => {
      throw new Error('Falha simulada ao inserir ledger.');
    };
    const failingService = new TransactionService(
      failingLedgerRepository,
      new AccountRepository(),
      new TransactionManager(),
    );
    await expect(
      failingService.withdraw(
        { accountNumber: accountA1Number, amountCents: '100' },
        {
          customerId: customerAId,
          operatorUserId: operatorId,
          serviceSessionId: serviceSessionAId,
          idempotencyKey: rollbackKey,
        },
      ),
    ).rejects.toThrow('Falha simulada ao inserir ledger.');
    expect(
      (await prisma.account.findUniqueOrThrow({ where: { id: accountA1Id } })).balanceCents,
    ).toBe(balanceBeforeRollback);
    expect(
      (await prisma.account.findFirstOrThrow({ where: { type: 'SYSTEM' } })).balanceCents,
    ).toBe(systemBeforeRollback);
    expect(
      await prisma.bankTransaction.findUnique({
        where: {
          operatorUserId_idempotencyKey: {
            operatorUserId: operatorId,
            idempotencyKey: rollbackKey,
          },
        },
      }),
    ).toBeNull();
  });

  it('mostra extrato paginado com operador, contraparte e filtro por tipo', async () => {
    const statement = await get(
      `${apiBase}/customer-service/accounts/${accountA1Number}/statement?page=1&pageSize=2`,
      serviceSessionAId,
    );
    expect(statement.status).toBe(200);
    expect(statement.body.total).toBeGreaterThanOrEqual(6);
    expect(statement.body.data[0].operator.name).toBe('Operador de Teste');
    const latestCounterparty = statement.body.data[0].counterparty as {
      number: string | null;
      name: string;
    };
    expect(latestCounterparty.number ?? latestCounterparty.name).toMatch(/\*|em espécie/);
    expect(statement.body.data[0].direction).toBeTruthy();
    const pixStatement = await get(
      `${apiBase}/customer-service/accounts/${accountA1Number}/statement?page=1&pageSize=20&type=TRANSFER&transferType=PIX`,
      serviceSessionAId,
    );
    expect(pixStatement.body.total).toBe(1);
    expect(pixStatement.body.data[0].transferType).toBe('PIX');
  });

  it('mantém o ledger conciliado', async () => {
    const accountStatus = await get(
      `${apiBase}/customer-service/accounts/${accountA1Number}`,
      serviceSessionAId,
    );
    expect(accountStatus.status).toBe(200);
    const reconciliation = await get(`${apiBase}/ledger/reconciliation`);
    expect(reconciliation.body.balanced).toBe(true);
    expect(reconciliation.body.mismatchedAccounts).toEqual([]);
    expect(reconciliation.body.totalDebitsCents).toBe(reconciliation.body.totalCreditsCents);
  });

  it('registra operador e atendimento na transação', async () => {
    const transaction = await prisma.bankTransaction.findFirstOrThrow({
      where: { id: tedId },
    });
    expect(transaction.operatorUserId).toBe(
      (await prisma.user.findUniqueOrThrow({ where: { email: 'operator@example.test' } })).id,
    );
    expect(transaction.serviceSessionId).toBe(serviceSessionAId);
  });

  it('recusa excluir cliente que só recebeu TED', async () => {
    const createReceiver = await post(`${apiBase}/customers`, {
      name: 'Cliente que só recebeu TED',
      cpf: '39053344705',
      customerPassword: '518372',
    });
    expect(createReceiver.status).toBe(201);
    const receiverTed = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'TED',
        sourceAccountNumber: accountA1Number,
        destinationAgency: '0001',
        destinationAccountNumber: createReceiver.body.accounts[0].number,
        amountCents: '100',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(receiverTed.status).toBe(201);
    const receiverDelete = await remove(`${apiBase}/customers/39053344705`);
    expect(receiverDelete.status).toBe(409);
    expect(receiverDelete.body.error.code).toBe('CUSTOMER_HAS_HISTORY');
  });

  it('recusa excluir cliente com histórico e lista suas contas', async () => {
    expect((await remove(`${apiBase}/customers/${cpfA}`)).status).toBe(409);
    const listedA = (await get(`${apiBase}/customers?cpf=${cpfA}`)).body.data[0];
    expect(listedA.cpf).toBe('***.982.247-**');
    expect(listedA.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agency: '0001', number: accountA1Number, type: 'CHECKING' }),
        expect.objectContaining({ agency: '0001', number: accountA2Number, type: 'SAVINGS' }),
      ]),
    );
    const detailA = (await get(`${apiBase}/customers/${cpfA}`)).body;
    expect(detailA.accounts.map((account: { number: string }) => account.number)).toEqual(
      expect.arrayContaining([accountA1Number, accountA2Number]),
    );
  });
});
