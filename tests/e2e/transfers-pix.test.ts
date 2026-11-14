import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Test } from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { env } from '../../src/config/env.js';
import { hashPassword } from '../../src/utils/password.js';
import { createAccessToken } from '../../src/utils/token.js';

type Actor = {
  cpf: string;
  password: string;
  accountId: string;
  accountNumber: string;
  sessionId: string;
};

const apiBase = '/api/v1';
const service = `${apiBase}/customer-service`;
const originalLimits = {
  dailyTransferLimitCents: env.dailyTransferLimitCents,
  pixNightLimitCents: env.pixNightLimitCents,
};
let token = '';
let actorA: Actor;
let actorB: Actor;
let actorC: Actor;
let actorD: Actor;
let accountA2Number = '';
let accountC2Number = '';
let pixBeneficiaryId = '';
let tedBeneficiaryId = '';

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

// Abrir atendimento e devolver seu identificador
async function openSession(cpf: string, customerPassword: string): Promise<string> {
  const response = await post(`${apiBase}/service-sessions`, { cpf, customerPassword });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.id as string;
}

// Simular a data e hora do banco e renovar o JWT do operador nesse horário
async function travelTo(isoDate: string): Promise<void> {
  vi.setSystemTime(new Date(isoDate));
  const operator = await prisma.user.findUniqueOrThrow({
    where: { email: 'operator@example.test' },
  });
  token = await createAccessToken(operator.id);
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

// Cadastrar um cliente, abrir seu atendimento e devolver os dados da primeira conta
async function registerActor(name: string, cpf: string, password: string): Promise<Actor> {
  const created = await post(`${apiBase}/customers`, { name, cpf, customerPassword: password });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const sessionId = await openSession(cpf, password);
  return {
    cpf,
    password,
    accountId: created.body.accounts[0].id as string,
    accountNumber: created.body.accounts[0].number as string,
    sessionId,
  };
}

// Abrir uma conta adicional no atendimento do cliente e devolver seu número
async function openExtraAccount(actor: Actor): Promise<string> {
  const response = await post(`${service}/accounts`, { type: 'SAVINGS' }, actor.sessionId);
  expect(response.status).toBe(201);
  return response.body.number as string;
}

// Depositar valor em espécie na conta do cliente atendido
async function deposit(actor: Actor, amountCents: string): Promise<void> {
  const response = await post(
    `${service}/transactions/deposits`,
    { accountNumber: actor.accountNumber, amountCents },
    actor.sessionId,
    randomUUID(),
  );
  expect(response.status, JSON.stringify(response.body)).toBe(201);
}

// Enviar uma transferência no atendimento do cliente informado
function transfer(actor: Actor, body: object, idempotencyKey: string = randomUUID()): Test {
  return post(`${service}/transactions/transfers`, body, actor.sessionId, idempotencyKey);
}

// Enviar um PIX da conta principal do cliente para a chave informada
function sendPix(actor: Actor, pixKey: string, amountCents: string): Test {
  return transfer(actor, {
    transferType: 'PIX',
    sourceAccountNumber: actor.accountNumber,
    pixKey,
    amountCents,
  });
}

beforeAll(async () => {
  await prisma.$connect();
  await clearTestDatabase();
  await prisma.account.create({
    data: { agency: '0000', number: 'SYSTEM', type: 'SYSTEM', balanceCents: 0n },
  });
  const operator = await prisma.user.create({
    data: {
      name: 'Operador de Teste',
      email: 'operator@example.test',
      passwordHash: await hashPassword('AdminPassword!123'),
    },
  });
  token = await createAccessToken(operator.id);
  env.dailyTransferLimitCents = 1_000_000_000n;
  env.pixNightLimitCents = 1_000_000_000n;

  actorA = await registerActor('Cliente A', '52998224725', '291847');
  actorB = await registerActor('Cliente B', '11144477735', '847291');
  actorC = await registerActor('Cliente C', '93541134780', '275918');
  actorD = await registerActor('Cliente D', '12345678909', '736194');
  accountA2Number = await openExtraAccount(actorA);
  accountC2Number = await openExtraAccount(actorC);
  await deposit(actorA, '1000000');
  await deposit(actorB, '50000');
  await deposit(actorC, '100000');
  await deposit(actorD, '100000');
  const emailKey = await post(
    `${service}/pix-keys`,
    { accountNumber: actorB.accountNumber, keyType: 'EMAIL', keyValue: 'b@example.test' },
    actorB.sessionId,
  );
  expect(emailKey.status).toBe(201);
});

afterAll(async () => {
  env.dailyTransferLimitCents = originalLimits.dailyTransferLimitCents;
  env.pixNightLimitCents = originalLimits.pixNightLimitCents;
  await prisma.$disconnect();
});

describe('valores', () => {
  it('recusa valor com 20 dígitos antes de chegar ao banco', async () => {
    const response = await post(
      `${service}/transactions/deposits`,
      { accountNumber: actorA.accountNumber, amountCents: '99999999999999999999' },
      actorA.sessionId,
      randomUUID(),
    );
    expect(response.status).toBe(422);
  });

  it('recusa valor acima do teto por operação com AMOUNT_ABOVE_LIMIT', async () => {
    const response = await post(
      `${service}/transactions/deposits`,
      {
        accountNumber: actorA.accountNumber,
        amountCents: (env.maxOperationCents + 1n).toString(),
      },
      actorA.sessionId,
      randomUUID(),
    );
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('AMOUNT_ABOVE_LIMIT');
  });
});

describe('chave Pix de telefone', () => {
  it('grava a chave PHONE no formato +55', async () => {
    const response = await post(
      `${service}/pix-keys`,
      { accountNumber: actorB.accountNumber, keyType: 'PHONE', keyValue: '(11) 98765-4321' },
      actorB.sessionId,
    );
    expect(response.status).toBe(201);
    expect(response.body.keyValue).toBe('+5511987654321');
  });

  it('encontra o destino quando o PIX usa o telefone com +55', async () => {
    const response = await sendPix(actorA, '+55 11 98765-4321', '1000');
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.transferType).toBe('PIX');
  });

  it('não encontra o telefone quando o PIX usa os mesmos 11 dígitos sem +', async () => {
    const response = await sendPix(actorA, '11987654321', '1000');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PIX_KEY_NOT_FOUND');
  });
});

describe('transferência por favorecido', () => {
  it('transfere para um favorecido PIX e grava a transação como PIX', async () => {
    const created = await post(
      `${service}/beneficiaries`,
      { nickname: 'Cliente B Pix', transferType: 'PIX', pixKey: 'b@example.test' },
      actorA.sessionId,
    );
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    pixBeneficiaryId = created.body.id as string;
    const response = await transfer(actorA, {
      transferType: 'BENEFICIARY',
      sourceAccountNumber: actorA.accountNumber,
      beneficiaryId: pixBeneficiaryId,
      amountCents: '1500',
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.transferType).toBe('PIX');
    const stored = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: response.body.id as string },
    });
    expect(stored.transferType).toBe('PIX');
    expect(stored.pixKeyUsed).toBe('b@example.test');
  });

  it('transfere para um favorecido TED e grava a transação como TED', async () => {
    const created = await post(
      `${service}/beneficiaries`,
      {
        nickname: 'Cliente B Ted',
        transferType: 'TED',
        destinationAgency: '0001',
        destinationAccountNumber: actorB.accountNumber,
      },
      actorA.sessionId,
    );
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    tedBeneficiaryId = created.body.id as string;
    const response = await transfer(actorA, {
      transferType: 'BENEFICIARY',
      sourceAccountNumber: actorA.accountNumber,
      beneficiaryId: tedBeneficiaryId,
      amountCents: '2000',
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.transferType).toBe('TED');
    expect(response.body.feeCents).toBe(env.tedFeeCents.toString());
    const stored = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: response.body.id as string },
    });
    expect(stored.transferType).toBe('TED');
  });

  it('responde 404 para um favorecido que pertence a outro cliente', async () => {
    const response = await transfer(actorB, {
      transferType: 'BENEFICIARY',
      sourceAccountNumber: actorB.accountNumber,
      beneficiaryId: pixBeneficiaryId,
      amountCents: '1000',
    });
    expect(response.status).toBe(404);
  });

  it('devolve o resultado gravado ao repetir a mesma Idempotency-Key', async () => {
    const idempotencyKey = randomUUID();
    const body = {
      transferType: 'BENEFICIARY',
      sourceAccountNumber: actorA.accountNumber,
      beneficiaryId: pixBeneficiaryId,
      amountCents: '700',
    };
    const first = await transfer(actorA, body, idempotencyKey);
    const second = await transfer(actorA, body, idempotencyKey);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });
});

describe('regras de destino', () => {
  it('recusa TED para conta do mesmo titular com TED_SAME_OWNER_USE_INTERNAL', async () => {
    const response = await transfer(actorA, {
      transferType: 'TED',
      sourceAccountNumber: actorA.accountNumber,
      destinationAgency: '0001',
      destinationAccountNumber: accountA2Number,
      amountCents: '1000',
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('TED_SAME_OWNER_USE_INTERNAL');
  });

  it('responde DESTINATION_UNAVAILABLE para destino bloqueado de outro cliente', async () => {
    const blocked = await patch(`${apiBase}/accounts/${actorB.accountNumber}/status`, {
      status: 'BLOCKED',
      reason: 'Teste de destino bloqueado',
    });
    expect(blocked.status).toBe(200);
    try {
      const response = await sendPix(actorA, 'b@example.test', '1000');
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('DESTINATION_UNAVAILABLE');
    } finally {
      await patch(`${apiBase}/accounts/${actorB.accountNumber}/status`, { status: 'ACTIVE' });
    }
  });
});

describe('extrato', () => {
  it('mostra "Depósito em espécie" como contraparte de um depósito', async () => {
    const response = await get(
      `${service}/accounts/${actorA.accountNumber}/statement?type=DEPOSIT&page=1&pageSize=5`,
      actorA.sessionId,
    );
    expect(response.status).toBe(200);
    expect(response.body.data[0].counterparty).toEqual({
      agency: null,
      number: null,
      name: 'Depósito em espécie',
    });
  });

  it('recusa período com data inicial maior que a final', async () => {
    const response = await get(
      `${service}/accounts/${actorA.accountNumber}/statement?from=2026-11-10T00:00:00.000Z&to=2026-11-01T00:00:00.000Z`,
      actorA.sessionId,
    );
    expect(response.status).toBe(422);
  });
});

describe('limite de chaves Pix', () => {
  it('grava no máximo o limite de chaves em 10 criações simultâneas na mesma conta', async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        post(
          `${service}/pix-keys`,
          { accountNumber: accountA2Number, keyType: 'RANDOM' },
          actorA.sessionId,
        ),
      ),
    );
    const statuses = responses.map((response) => response.status);
    expect(statuses.every((status) => status === 201 || status === 422)).toBe(true);
    const stored = await prisma.pixKey.count({ where: { account: { number: accountA2Number } } });
    expect(stored).toBeLessThanOrEqual(env.pixKeysPerAccount);
    expect(stored).toBe(statuses.filter((status) => status === 201).length);
  });
});

describe('limite diário de PIX e TED', () => {
  beforeAll(() => {
    env.dailyTransferLimitCents = 10_000n;
  });

  it('recusa a segunda transferência que soma acima do limite diário', async () => {
    expect((await sendPix(actorC, 'b@example.test', '6000')).status).toBe(201);
    const response = await sendPix(actorC, 'b@example.test', '5000');
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DAILY_LIMIT_EXCEEDED');
  });

  it('não conta transferência INTERNAL no limite diário', async () => {
    const internal = await transfer(actorC, {
      transferType: 'INTERNAL',
      sourceAccountNumber: actorC.accountNumber,
      destinationAccountNumber: accountC2Number,
      amountCents: '8000',
    });
    expect(internal.status, JSON.stringify(internal.body)).toBe(201);
    const response = await sendPix(actorC, 'b@example.test', '4000');
    expect(response.status, JSON.stringify(response.body)).toBe(201);
  });

  it('volta a aceitar transferências no dia bancário seguinte', async () => {
    const originalToken = token;
    const nextDay = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await travelTo(nextDay);
      actorC.sessionId = await openSession(actorC.cpf, actorC.password);
      const response = await sendPix(actorC, 'b@example.test', '9000');
      expect(response.status, JSON.stringify(response.body)).toBe(201);
    } finally {
      vi.useRealTimers();
      token = originalToken;
    }
  });

  it('não ultrapassa o limite diário com duas transferências simultâneas', async () => {
    const responses = await Promise.all([
      sendPix(actorD, 'b@example.test', '6000'),
      sendPix(actorD, 'b@example.test', '6000'),
    ]);
    const accepted = responses.filter((response) => response.status === 201);
    expect(accepted.length, JSON.stringify(responses.map((r) => r.body))).toBeGreaterThanOrEqual(1);
    const stored = await prisma.bankTransaction.aggregate({
      _sum: { amountCents: true },
      where: { type: 'TRANSFER', transferType: 'PIX', sourceAccountId: actorD.accountId },
    });
    expect(stored._sum.amountCents ?? 0n).toBeLessThanOrEqual(env.dailyTransferLimitCents);
  });
});

describe('conciliação', () => {
  it('mantém o ledger equilibrado ao final dos testes', async () => {
    const response = await get(`${apiBase}/ledger/reconciliation`);
    expect(response.status).toBe(200);
    expect(response.body.balanced).toBe(true);
  });
});
