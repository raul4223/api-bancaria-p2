import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Test } from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { env } from '../../src/config/env.js';
import { hashPassword } from '../../src/utils/password.js';
import { createAccessToken } from '../../src/utils/token.js';
import { SignJWT } from 'jose';
import { AccountRepository } from '../../src/repositories/AccountRepository.js';
import { TransactionRepository } from '../../src/repositories/TransactionRepository.js';
import { TransactionService } from '../../src/services/TransactionService.js';

const apiBase = '/api/v1';
let token = '';
let customerAId = '';
let customerBId = '';
let customerCId = '';
let accountA1Id = '';
let accountA2Id = '';
let accountB1Id = '';
let accountB2Id = '';
let serviceSessionAId = '';
let serviceSessionBId = '';
let pixKeyB = '';
let pixKeyBId = '';
let otherOperatorId = '';

// Criar requisição GET autenticada com atendimento opcional
function get(path: string, sessionId?: string): Test {
  let call = request(app).get(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  return call;
}

// Criar requisição POST autenticada com atendimento e idempotência opcionais
function post(path: string, body: object, sessionId?: string, idempotencyKey?: string): Test {
  let call = request(app).post(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  if (idempotencyKey) call = call.set('Idempotency-Key', idempotencyKey);
  return call.send(body);
}

// Criar requisição PATCH autenticada com atendimento opcional
function patch(path: string, body: object, sessionId?: string): Test {
  let call = request(app).patch(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  return call.send(body);
}

// Criar requisição DELETE autenticada com atendimento opcional
function remove(path: string, sessionId?: string): Test {
  let call = request(app).delete(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  return call;
}

// Abrir atendimento e devolver seu identificador
async function openSession(cpf: string, customerPassword: string): Promise<string> {
  const response = await post(`${apiBase}/service-sessions`, { cpf, customerPassword });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.id as string;
}

// Abrir conta corrente ou poupança no atendimento
async function openAccount(sessionId: string, type: 'CHECKING' | 'SAVINGS'): Promise<string> {
  const response = await post(`${apiBase}/customer-service/accounts`, { type }, sessionId);
  expect(response.status).toBe(201);
  return response.body.id as string;
}

// Limpar exclusivamente o banco de teste em ordem segura de chaves estrangeiras
async function clearTestDatabase(): Promise<void> {
  if (env.databaseName !== 'bank_api_test')
    throw new Error('Recusada limpeza fora do banco de teste.');
  await prisma.ledgerEntry.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.pixKey.deleteMany();
  await prisma.beneficiary.deleteMany();
  await prisma.serviceSession.deleteMany();
  await prisma.account.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await prisma.$connect();
  await clearTestDatabase();
  await prisma.account.create({
    data: { agency: '0000', number: 'SYSTEM', type: 'SYSTEM', balanceCents: 0n },
  });
  await prisma.user.create({
    data: {
      name: 'Operador de Teste',
      email: 'operator@example.test',
      passwordHash: await hashPassword('AdminPassword!123'),
    },
  });
  const otherOperator = await prisma.user.create({
    data: {
      name: 'Segundo Operador',
      email: 'operator-two@example.test',
      passwordHash: await hashPassword('SecondPassword!123'),
    },
  });
  otherOperatorId = otherOperator.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('API bancária simulada', () => {
  it('autentica o operador e conclui o CRUD de clientes', async () => {
    const invalidLogin = await request(app)
      .post(`${apiBase}/auth/login`)
      .send({ email: 'operator@example.test', password: 'incorreta' });
    expect(invalidLogin.status).toBe(401);
    const noToken = await request(app).get(`${apiBase}/customers`);
    expect(noToken.status).toBe(401);
    const invalidToken = await request(app)
      .get(`${apiBase}/customers`)
      .set('Authorization', 'Bearer token-inválido');
    expect(invalidToken.status).toBe(401);
    const expiredToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('11111111-1111-4111-8111-111111111111')
      .setIssuer(env.jwtIssuer)
      .setAudience(env.jwtAudience)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.jwtSecret));
    expect(
      (
        await request(app)
          .get(`${apiBase}/customers`)
          .set('Authorization', `Bearer ${expiredToken}`)
      ).status,
    ).toBe(401);
    const wrongSecretToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('11111111-1111-4111-8111-111111111111')
      .setIssuer(env.jwtIssuer)
      .setAudience(env.jwtAudience)
      .setExpirationTime('60m')
      .sign(new TextEncoder().encode('different-secret-that-is-at-least-32-characters'));
    expect(
      (
        await request(app)
          .get(`${apiBase}/customers`)
          .set('Authorization', `Bearer ${wrongSecretToken}`)
      ).status,
    ).toBe(401);

    const login = await request(app)
      .post(`${apiBase}/auth/login`)
      .send({ email: 'operator@example.test', password: 'AdminPassword!123' });
    expect(login.status).toBe(200);
    expect(login.body.tokenType).toBe('Bearer');
    token = login.body.accessToken as string;

    const invalidCpf = await post(`${apiBase}/customers`, {
      name: 'Inválido',
      cpf: '11111111111',
      customerPassword: '291847',
    });
    expect(invalidCpf.status).toBe(422);
    const weakPassword = await post(`${apiBase}/customers`, {
      name: 'Inválido',
      cpf: '12345678909',
      customerPassword: '123456',
    });
    expect(weakPassword.status).toBe(422);

    const createA = await post(`${apiBase}/customers`, {
      name: 'Cliente A',
      cpf: '52998224725',
      email: 'a@example.test',
      customerPassword: '291847',
    });
    const createB = await post(`${apiBase}/customers`, {
      name: 'Cliente B',
      cpf: '11144477735',
      email: 'b@example.test',
      customerPassword: '847291',
    });
    const createC = await post(`${apiBase}/customers`, {
      name: 'Cliente C',
      cpf: '93541134780',
      customerPassword: '275918',
    });
    expect(createA.status).toBe(201);
    expect(createB.status).toBe(201);
    expect(createC.status).toBe(201);
    expect(createA.body).not.toHaveProperty('passwordHash');
    customerAId = createA.body.id as string;
    customerBId = createB.body.id as string;
    customerCId = createC.body.id as string;

    const duplicateEmail = await post(`${apiBase}/customers`, {
      name: 'E-mail duplicado',
      cpf: '12345678909',
      email: 'a@example.test',
      customerPassword: '736194',
    });
    expect(duplicateEmail.status).toBe(409);

    const duplicate = await post(`${apiBase}/customers`, {
      name: 'Duplicado',
      cpf: '52998224725',
      customerPassword: '291847',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_CUSTOMER');

    const list = await get(`${apiBase}/customers`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');
    expect(list.body.data.find((customer: { id: string }) => customer.id === customerAId).cpf).toBe(
      '***.982.247-**',
    );
    expect((await get(`${apiBase}/customers/${customerBId}`)).status).toBe(200);
    expect(
      (await get(`${apiBase}/customers?search=Cliente%20A`)).body.data.map(
        (customer: { id: string }) => customer.id,
      ),
    ).toContain(customerAId);
    expect(
      (await get(`${apiBase}/customers?cpf=52998224725`)).body.data.map(
        (customer: { id: string }) => customer.id,
      ),
    ).toEqual([customerAId]);
    const detail = await get(`${apiBase}/customers/${customerAId}`);
    expect(detail.body.cpf).toBe('52998224725');
    expect(detail.body).not.toHaveProperty('passwordHash');

    const updated = await patch(`${apiBase}/customers/${customerAId}`, {
      name: 'Cliente A Atualizado',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Cliente A Atualizado');

    const createTemporary = await post(`${apiBase}/customers`, {
      name: 'Cadastro Temporário',
      cpf: '12345678909',
      customerPassword: '736194',
    });
    expect(createTemporary.status).toBe(201);
    expect((await remove(`${apiBase}/customers/${createTemporary.body.id}`)).status).toBe(204);
    expect((await get(`${apiBase}/customers/${createTemporary.body.id}`)).status).toBe(404);
  });

  it('controla atendimentos, isolamento por cliente e os CRUDs dependentes de conta', async () => {
    const badAttempt = await post(`${apiBase}/service-sessions`, {
      cpf: '93541134780',
      customerPassword: '111111',
    });
    expect(badAttempt.status).toBe(401);
    const sessionC = await openSession('93541134780', '275918');
    expect(
      (await prisma.customer.findUniqueOrThrow({ where: { id: customerCId } }))
        .failedPasswordAttempts,
    ).toBe(0);
    const replacementSessionC = await openSession('93541134780', '275918');
    expect(
      (await prisma.serviceSession.findUniqueOrThrow({ where: { id: sessionC } })).status,
    ).toBe('CLOSED');
    expect(
      (await patch(`${apiBase}/service-sessions/${replacementSessionC}/close`, {})).status,
    ).toBe(200);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(
        (
          await post(`${apiBase}/service-sessions`, {
            cpf: '93541134780',
            customerPassword: '111111',
          })
        ).status,
      ).toBe(401);
    }
    const locked = await post(`${apiBase}/service-sessions`, {
      cpf: '93541134780',
      customerPassword: '111111',
    });
    expect(locked.status).toBe(423);

    serviceSessionBId = await openSession('11144477735', '847291');
    accountB1Id = await openAccount(serviceSessionBId, 'CHECKING');
    accountB2Id = await openAccount(serviceSessionBId, 'SAVINGS');
    const createPix = await post(
      `${apiBase}/customer-service/pix-keys`,
      { accountId: accountB1Id, keyType: 'EMAIL', keyValue: 'b@example.test' },
      serviceSessionBId,
    );
    expect(createPix.status).toBe(201);
    pixKeyB = createPix.body.keyValue as string;
    pixKeyBId = createPix.body.id as string;

    const randomKey = await post(
      `${apiBase}/customer-service/pix-keys`,
      { accountId: accountB2Id, keyType: 'RANDOM' },
      serviceSessionBId,
    );
    expect(randomKey.status).toBe(201);
    expect(randomKey.body.keyValue).toBeTruthy();
    const pixList = await get(`${apiBase}/customer-service/pix-keys`, serviceSessionBId);
    expect(pixList.body.total).toBe(2);
    expect(
      (await get(`${apiBase}/customer-service/pix-keys/${randomKey.body.id}`, serviceSessionBId))
        .status,
    ).toBe(200);
    const movePix = await patch(
      `${apiBase}/customer-service/pix-keys/${randomKey.body.id}`,
      { accountId: accountB1Id },
      serviceSessionBId,
    );
    expect(movePix.status).toBe(200);
    expect(movePix.body.accountId).toBe(accountB1Id);
    expect(
      (await get(`${apiBase}/customer-service/pix-keys/${randomKey.body.id}`, serviceSessionBId))
        .body.accountId,
    ).toBe(accountB1Id);
    expect(
      (await remove(`${apiBase}/customer-service/pix-keys/${randomKey.body.id}`, serviceSessionBId))
        .status,
    ).toBe(204);
    expect(
      (await get(`${apiBase}/customer-service/pix-keys/${randomKey.body.id}`, serviceSessionBId))
        .status,
    ).toBe(404);
    const wrongCpfKey = await post(
      `${apiBase}/customer-service/pix-keys`,
      { accountId: accountB1Id, keyType: 'CPF', keyValue: '52998224725' },
      serviceSessionBId,
    );
    expect(wrongCpfKey.status).toBe(422);
    const duplicateKey = await post(
      `${apiBase}/customer-service/pix-keys`,
      { accountId: accountB1Id, keyType: 'EMAIL', keyValue: 'b@example.test' },
      serviceSessionBId,
    );
    expect(duplicateKey.status).toBe(409);
    for (let index = 0; index < 4; index += 1) {
      expect(
        (
          await post(
            `${apiBase}/customer-service/pix-keys`,
            { accountId: accountB1Id, keyType: 'RANDOM' },
            serviceSessionBId,
          )
        ).status,
      ).toBe(201);
    }
    const pixKeyLimit = await post(
      `${apiBase}/customer-service/pix-keys`,
      { accountId: accountB1Id, keyType: 'RANDOM' },
      serviceSessionBId,
    );
    expect(pixKeyLimit.status).toBe(422);

    expect((await patch(`${apiBase}/service-sessions/${serviceSessionBId}/close`, {})).status).toBe(
      200,
    );
    serviceSessionAId = await openSession('52998224725', '291847');
    const otherToken = await createAccessToken(otherOperatorId);
    const otherOperatorSessionUse = await request(app)
      .get(`${apiBase}/customer-service/accounts`)
      .set('Authorization', `Bearer ${otherToken}`)
      .set('X-Service-Session-Id', serviceSessionAId);
    expect(otherOperatorSessionUse.status).toBe(403);
    accountA1Id = await openAccount(serviceSessionAId, 'CHECKING');
    accountA2Id = await openAccount(serviceSessionAId, 'SAVINGS');
    expect((await get(`${apiBase}/customer-service/accounts`, serviceSessionAId)).body.total).toBe(
      2,
    );
    const [accountA1, accountA2] = await Promise.all([
      prisma.account.findUniqueOrThrow({ where: { id: accountA1Id } }),
      prisma.account.findUniqueOrThrow({ where: { id: accountA2Id } }),
    ]);
    expect(accountA1.balanceCents).toBe(0n);
    expect(accountA2.balanceCents).toBe(0n);
    expect(accountA1.number).not.toBe(accountA2.number);
    expect(
      (await get(`${apiBase}/customer-service/accounts/${accountB1Id}`, serviceSessionAId)).status,
    ).toBe(404);

    const systemAccount = await prisma.account.findFirstOrThrow({ where: { type: 'SYSTEM' } });
    expect(
      (await get(`${apiBase}/customer-service/accounts/${systemAccount.id}`, serviceSessionAId))
        .status,
    ).toBe(404);
    expect(
      (
        await patch(`${apiBase}/accounts/${systemAccount.id}/status`, {
          status: 'BLOCKED',
          reason: 'Teste inválido',
        })
      ).status,
    ).toBe(404);

    expect(
      (await get(`${apiBase}/customer-service/pix-keys/${pixKeyBId}`, serviceSessionAId)).status,
    ).toBe(404);
    expect(
      (
        await patch(
          `${apiBase}/customer-service/pix-keys/${pixKeyBId}`,
          { accountId: accountA1Id },
          serviceSessionAId,
        )
      ).status,
    ).toBe(404);
    expect(
      (await remove(`${apiBase}/customer-service/pix-keys/${pixKeyBId}`, serviceSessionAId)).status,
    ).toBe(404);

    const serviceSessionBForSecondOperator = await request(app)
      .post(`${apiBase}/service-sessions`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ cpf: '11144477735', customerPassword: '847291' });
    expect(serviceSessionBForSecondOperator.status).toBe(201);
    const beneficiaryB = await request(app)
      .post(`${apiBase}/customer-service/beneficiaries`)
      .set('Authorization', `Bearer ${otherToken}`)
      .set('X-Service-Session-Id', serviceSessionBForSecondOperator.body.id as string)
      .send({
        nickname: 'Cliente A',
        transferType: 'TED',
        destinationAgency: '0001',
        destinationAccountNumber: accountA1.number,
      });
    expect(beneficiaryB.status).toBe(201);
    const beneficiaryBId = beneficiaryB.body.id as string;
    expect(
      (await get(`${apiBase}/customer-service/beneficiaries/${beneficiaryBId}`, serviceSessionAId))
        .status,
    ).toBe(404);
    expect(
      (
        await patch(
          `${apiBase}/customer-service/beneficiaries/${beneficiaryBId}`,
          { nickname: 'Alterado indevidamente' },
          serviceSessionAId,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await remove(
          `${apiBase}/customer-service/beneficiaries/${beneficiaryBId}`,
          serviceSessionAId,
        )
      ).status,
    ).toBe(404);
    expect(
      (await get(`${apiBase}/customer-service/beneficiaries`, serviceSessionAId)).body.total,
    ).toBe(0);
    expect(
      (
        await request(app)
          .patch(`${apiBase}/service-sessions/${serviceSessionBForSecondOperator.body.id}/close`)
          .set('Authorization', `Bearer ${otherToken}`)
          .send({})
      ).status,
    ).toBe(200);

    const ownPixKey = await post(
      `${apiBase}/customer-service/pix-keys`,
      { accountId: accountA2Id, keyType: 'EMAIL', keyValue: 'a@example.test' },
      serviceSessionAId,
    );
    expect(ownPixKey.status).toBe(201);
    expect(
      (
        await patch(
          `${apiBase}/customer-service/pix-keys/${ownPixKey.body.id}`,
          { accountId: accountA1Id },
          serviceSessionAId,
        )
      ).status,
    ).toBe(200);
    expect(
      (await remove(`${apiBase}/customer-service/pix-keys/${ownPixKey.body.id}`, serviceSessionAId))
        .status,
    ).toBe(204);

    const ownAccountBeneficiary = await post(
      `${apiBase}/customer-service/beneficiaries`,
      {
        nickname: 'Conta própria',
        transferType: 'TED',
        destinationAgency: '0001',
        destinationAccountNumber: accountA1.number,
      },
      serviceSessionAId,
    );
    expect(ownAccountBeneficiary.status).toBe(422);
    const systemBeneficiary = await post(
      `${apiBase}/customer-service/beneficiaries`,
      {
        nickname: 'Conta interna',
        transferType: 'TED',
        destinationAgency: '0000',
        destinationAccountNumber: 'SYSTEM',
      },
      serviceSessionAId,
    );
    expect(systemBeneficiary.status).toBe(422);
    const missingBeneficiary = await post(
      `${apiBase}/customer-service/beneficiaries`,
      {
        nickname: 'Destino ausente',
        transferType: 'TED',
        destinationAgency: '0001',
        destinationAccountNumber: '9999999',
      },
      serviceSessionAId,
    );
    expect(missingBeneficiary.status).toBe(422);
    const missingPixBeneficiary = await post(
      `${apiBase}/customer-service/beneficiaries`,
      {
        nickname: 'Chave ausente',
        transferType: 'PIX',
        pixKey: 'missing@example.test',
      },
      serviceSessionAId,
    );
    expect(missingPixBeneficiary.status).toBe(422);

    const beneficiary = await post(
      `${apiBase}/customer-service/beneficiaries`,
      {
        nickname: 'Cliente B',
        transferType: 'TED',
        destinationAgency: '0001',
        destinationAccountNumber: (
          await prisma.account.findUniqueOrThrow({ where: { id: accountB1Id } })
        ).number,
      },
      serviceSessionAId,
    );
    expect(beneficiary.status).toBe(201);
    expect(
      (await get(`${apiBase}/customer-service/beneficiaries`, serviceSessionAId)).body.total,
    ).toBe(1);
    expect(
      (
        await get(
          `${apiBase}/customer-service/beneficiaries/${beneficiary.body.id}`,
          serviceSessionAId,
        )
      ).status,
    ).toBe(200);
    const updatedBeneficiary = await patch(
      `${apiBase}/customer-service/beneficiaries/${beneficiary.body.id}`,
      { nickname: 'Favorecido B' },
      serviceSessionAId,
    );
    expect(updatedBeneficiary.body.nickname).toBe('Favorecido B');
    expect(
      (
        await get(
          `${apiBase}/customer-service/beneficiaries/${beneficiary.body.id}`,
          serviceSessionAId,
        )
      ).body.nickname,
    ).toBe('Favorecido B');
    const invalidBeneficiaryUpdate = await patch(
      `${apiBase}/customer-service/beneficiaries/${beneficiary.body.id}`,
      {
        destinationAgency: '0001',
        destinationAccountNumber: accountA1.number,
      },
      serviceSessionAId,
    );
    expect(invalidBeneficiaryUpdate.status).toBe(422);
    expect(
      (
        await get(
          `${apiBase}/customer-service/beneficiaries/${beneficiary.body.id}`,
          serviceSessionAId,
        )
      ).body.nickname,
    ).toBe('Favorecido B');
    expect(
      (
        await remove(
          `${apiBase}/customer-service/beneficiaries/${beneficiary.body.id}`,
          serviceSessionAId,
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await get(
          `${apiBase}/customer-service/beneficiaries/${beneficiary.body.id}`,
          serviceSessionAId,
        )
      ).status,
    ).toBe(404);

    expect(
      (
        await patch(`${apiBase}/accounts/${accountB1Id}/status`, {
          status: 'BLOCKED',
          reason: 'Conferência acadêmica',
        })
      ).status,
    ).toBe(200);
    expect(
      (await patch(`${apiBase}/accounts/${accountB1Id}/status`, { status: 'ACTIVE' })).status,
    ).toBe(200);
  });

  it('executa depósitos, saque, PIX, TED e INTERNAL com idempotência, auditoria e ledger equilibrado', async () => {
    const noSession = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountId: accountA1Id, amountCents: '10000' },
      undefined,
      randomUUID(),
    );
    expect(noSession.status).toBe(401);

    const depositKey = randomUUID();
    const deposit = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountId: accountA1Id, amountCents: '10000' },
      serviceSessionAId,
      depositKey,
    );
    expect(deposit.status).toBe(201);
    const repeatedDeposit = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountId: accountA1Id, amountCents: '10000' },
      serviceSessionAId,
      depositKey,
    );
    expect(repeatedDeposit.status).toBe(200);
    expect(repeatedDeposit.body.id).toBe(deposit.body.id);
    const conflictingDeposit = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountId: accountA1Id, amountCents: '9000' },
      serviceSessionAId,
      depositKey,
    );
    expect(conflictingDeposit.status).toBe(409);

    const internalKey = randomUUID();
    const internal = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'INTERNAL',
        sourceAccountId: accountA1Id,
        destinationAccountId: accountA2Id,
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
        sourceAccountId: accountA1Id,
        destinationAccountId: accountA2Id,
        amountCents: '1000',
      },
      serviceSessionAId,
      internalKey,
    );
    expect(repeatedInternal.status).toBe(200);
    expect(repeatedInternal.body.id).toBe(internal.body.id);

    const pix = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'PIX',
        sourceAccountId: accountA1Id,
        amountCents: '3000',
        pixKey: pixKeyB,
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(pix.status).toBe(201);
    expect(pix.body.transferType).toBe('PIX');

    const b1Number = (await prisma.account.findUniqueOrThrow({ where: { id: accountB1Id } }))
      .number;
    const ted = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'TED',
        sourceAccountId: accountA1Id,
        amountCents: '2000',
        destinationAgency: '0001',
        destinationAccountNumber: b1Number,
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(ted.status).toBe(201);
    expect(ted.body.feeCents).toBe('500');

    const withdrawal = await post(
      `${apiBase}/customer-service/transactions/withdrawals`,
      { accountId: accountA1Id, amountCents: '500' },
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

    const insufficient = await post(
      `${apiBase}/customer-service/transactions/withdrawals`,
      { accountId: accountA1Id, amountCents: '99999' },
      serviceSessionAId,
      randomUUID(),
    );
    expect(insufficient.status).toBe(422);
    const invalidAmount = await post(
      `${apiBase}/customer-service/transactions/deposits`,
      { accountId: accountA1Id, amountCents: '0' },
      serviceSessionAId,
      randomUUID(),
    );
    expect(invalidAmount.status).toBe(422);

    const missingPix = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'PIX',
        sourceAccountId: accountA1Id,
        amountCents: '100',
        pixKey: 'inexistente@example.test',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(missingPix.status).toBe(404);
    const sameAccountTransfer = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'INTERNAL',
        sourceAccountId: accountA1Id,
        destinationAccountId: accountA1Id,
        amountCents: '100',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(sameAccountTransfer.status).toBe(422);
    const crossCustomerInternal = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'INTERNAL',
        sourceAccountId: accountA1Id,
        destinationAccountId: accountB1Id,
        amountCents: '100',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(crossCustomerInternal.status).toBe(422);
    const otherCustomersSource = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'INTERNAL',
        sourceAccountId: accountB1Id,
        destinationAccountId: accountA1Id,
        amountCents: '100',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(otherCustomersSource.status).toBe(404);
    const feeOnlyShortfall = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'TED',
        sourceAccountId: accountA1Id,
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

    expect(
      (
        await patch(`${apiBase}/accounts/${accountB1Id}/status`, {
          status: 'BLOCKED',
          reason: 'Teste de bloqueio de destino',
        })
      ).status,
    ).toBe(200);
    const blockedDestination = await post(
      `${apiBase}/customer-service/transactions/transfers`,
      {
        transferType: 'PIX',
        sourceAccountId: accountA1Id,
        amountCents: '100',
        pixKey: pixKeyB,
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(blockedDestination.status).toBe(422);
    expect(
      (await patch(`${apiBase}/accounts/${accountB1Id}/status`, { status: 'ACTIVE' })).status,
    ).toBe(200);

    expect(
      (
        await patch(`${apiBase}/accounts/${accountA1Id}/status`, {
          status: 'BLOCKED',
          reason: 'Teste de bloqueio de origem',
        })
      ).status,
    ).toBe(200);
    const blockedSource = await post(
      `${apiBase}/customer-service/transactions/withdrawals`,
      {
        accountId: accountA1Id,
        amountCents: '100',
      },
      serviceSessionAId,
      randomUUID(),
    );
    expect(blockedSource.status).toBe(422);
    expect(
      (await patch(`${apiBase}/accounts/${accountA1Id}/status`, { status: 'ACTIVE' })).status,
    ).toBe(200);

    const concurrent = await Promise.all([
      post(
        `${apiBase}/customer-service/transactions/withdrawals`,
        { accountId: accountA1Id, amountCents: '2000' },
        serviceSessionAId,
        randomUUID(),
      ),
      post(
        `${apiBase}/customer-service/transactions/withdrawals`,
        { accountId: accountA1Id, amountCents: '2000' },
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

    const balanceBeforeDuplicate = (
      await prisma.account.findUniqueOrThrow({ where: { id: accountA1Id } })
    ).balanceCents;
    const duplicateKey = randomUUID();
    const simultaneousDuplicates = await Promise.all([
      post(
        `${apiBase}/customer-service/transactions/deposits`,
        { accountId: accountA1Id, amountCents: '100' },
        serviceSessionAId,
        duplicateKey,
      ),
      post(
        `${apiBase}/customer-service/transactions/deposits`,
        { accountId: accountA1Id, amountCents: '100' },
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
    const failingService = new TransactionService(failingLedgerRepository, new AccountRepository());
    await expect(
      failingService.withdraw(
        { accountId: accountA1Id, amountCents: '100' },
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

    const statement = await get(
      `${apiBase}/customer-service/accounts/${accountA1Id}/statement?page=1&pageSize=2`,
      serviceSessionAId,
    );
    expect(statement.status).toBe(200);
    expect(statement.body.total).toBeGreaterThanOrEqual(6);
    expect(statement.body.data[0].operator.name).toBe('Operador de Teste');
    expect(statement.body.data[0].counterparty.number).toMatch(/\*/);
    expect(statement.body.data[0].direction).toBeTruthy();
    const pixStatement = await get(
      `${apiBase}/customer-service/accounts/${accountA1Id}/statement?page=1&pageSize=20&type=TRANSFER&transferType=PIX`,
      serviceSessionAId,
    );
    expect(pixStatement.body.total).toBe(1);
    expect(pixStatement.body.data[0].transferType).toBe('PIX');

    const accountStatus = await get(
      `${apiBase}/customer-service/accounts/${accountA1Id}`,
      serviceSessionAId,
    );
    expect(accountStatus.status).toBe(200);
    expect((await get(`${apiBase}/ledger/reconciliation`)).body.balanced).toBe(true);
    const transaction = await prisma.bankTransaction.findFirstOrThrow({
      where: { id: ted.body.id },
    });
    expect(transaction.operatorUserId).toBe(
      (await prisma.user.findUniqueOrThrow({ where: { email: 'operator@example.test' } })).id,
    );
    expect(transaction.serviceSessionId).toBe(serviceSessionAId);

    expect((await patch(`${apiBase}/service-sessions/${serviceSessionAId}/close`, {})).status).toBe(
      200,
    );
    const closedSessionRequest = await post(
      `${apiBase}/customer-service/transactions/withdrawals`,
      { accountId: accountA1Id, amountCents: '1' },
      serviceSessionAId,
      randomUUID(),
    );
    expect(closedSessionRequest.status).toBe(403);
    expect((await remove(`${apiBase}/customers/${customerAId}`)).status).toBe(409);

    const expiringSession = await openSession('11144477735', '847291');
    await prisma.serviceSession.update({
      where: { id: expiringSession },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect((await get(`${apiBase}/customer-service/accounts`, expiringSession)).status).toBe(403);
    expect(
      (await prisma.serviceSession.findUniqueOrThrow({ where: { id: expiringSession } })).status,
    ).toBe('EXPIRED');
  });

  it('expõe Swagger, OpenAPI, health e as rotas documentadas', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/docs/')).status).toBe(200);
    const response = await request(app).get('/openapi.json');
    expect(response.status).toBe(200);
    const operations = Object.values(
      response.body.paths as Record<string, Record<string, unknown>>,
    ).flatMap((path) => Object.keys(path));
    expect(operations).toHaveLength(30);
    expect(response.body.components.securitySchemes.bearerAuth).toBeDefined();
    expect(response.body.components.securitySchemes.serviceSession).toBeDefined();
    expect(
      response.body.paths['/api/v1/customer-service/transactions/transfers'].post.requestBody
        .content['application/json'].examples,
    ).toHaveProperty('pix');
    expect(
      response.body.paths['/api/v1/customer-service/transactions/transfers'].post.requestBody
        .content['application/json'].examples,
    ).toHaveProperty('ted');
    expect(
      response.body.paths['/api/v1/customer-service/transactions/transfers'].post.requestBody
        .content['application/json'].examples,
    ).toHaveProperty('internal');
    expect(
      response.body.paths['/api/v1/customer-service/transactions/transfers'].post.responses['200'],
    ).toBeDefined();
  });
});
