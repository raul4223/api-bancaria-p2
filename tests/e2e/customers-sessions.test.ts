import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Test } from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { env } from '../../src/config/env.js';
import { hashPassword } from '../../src/utils/password.js';
import { createAccessToken } from '../../src/utils/token.js';

const apiBase = '/api/v1';
let token = '';

// Criar requisição GET autenticada com atendimento opcional
function get(path: string, sessionId?: string): Test {
  let call = request(app).get(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  return call;
}

// Criar requisição POST autenticada com atendimento opcional
function post(path: string, body: object, sessionId?: string): Test {
  let call = request(app).post(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  return call.send(body);
}

// Criar requisição PATCH autenticada com atendimento opcional
function patch(path: string, body: object, sessionId?: string): Test {
  let call = request(app).patch(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  return call.send(body);
}

// Criar requisição DELETE autenticada
function remove(path: string): Test {
  return request(app).delete(path).set('Authorization', `Bearer ${token}`);
}

// Cadastrar cliente de teste e devolver ID e número da primeira conta
async function createCustomer(
  cpf: string,
  customerPassword: string,
): Promise<{ id: string; accountNumber: string }> {
  const response = await post(`${apiBase}/customers`, {
    name: `Cliente ${cpf}`,
    cpf,
    customerPassword,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return {
    id: response.body.id as string,
    accountNumber: response.body.accounts[0].number as string,
  };
}

// Tentar abrir atendimento e devolver a resposta completa
function tryOpenSession(cpf: string, customerPassword: string): Test {
  return post(`${apiBase}/service-sessions`, { cpf, customerPassword });
}

// Abrir atendimento e devolver seu identificador
async function openSession(cpf: string, customerPassword: string): Promise<string> {
  const response = await tryOpenSession(cpf, customerPassword);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
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
  await prisma.accountStatusHistory.deleteMany();
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
  const operator = await prisma.user.create({
    data: {
      name: 'Operador de Teste',
      email: 'operator@example.test',
      passwordHash: await hashPassword('AdminPassword!123'),
    },
  });
  token = await createAccessToken(operator.id);
});

afterAll(async () => {
  await clearTestDatabase();
  await prisma.$disconnect();
});

describe('Clientes, senha do cliente, atendimento e bloqueio de contas', () => {
  it('bloqueia após 5 erros e, vencido o bloqueio, 1 erro não trava de novo', async () => {
    const cpf = '71460238001';
    const { id } = await createCustomer(cpf, '291847');
    for (let attempt = 0; attempt < 4; attempt += 1)
      expect((await tryOpenSession(cpf, '111111')).status).toBe(401);
    expect((await tryOpenSession(cpf, '111111')).status).toBe(423);
    expect((await tryOpenSession(cpf, '291847')).status).toBe(423);

    await prisma.customer.update({
      where: { id },
      data: { passwordLockedUntil: new Date(Date.now() - 60_000) },
    });
    expect((await tryOpenSession(cpf, '111111')).status).toBe(401);
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id } });
    expect(customer.failedPasswordAttempts).toBe(1);
    expect(customer.passwordLockedUntil).toBeNull();
  });

  it('conta 5 tentativas erradas simultâneas sem perder nenhuma', async () => {
    const cpf = '86315097286';
    const { id } = await createCustomer(cpf, '384615');
    await Promise.all(Array.from({ length: 5 }, () => tryOpenSession(cpf, '111111')));
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id } });
    expect(customer.failedPasswordAttempts).toBe(5);
    expect(customer.passwordLockedUntil).not.toBeNull();
  });

  it('exige atendimento do mesmo cliente para alterar o contato', async () => {
    const cpfOwner = '20587143690';
    const cpfOther = '64839201722';
    await createCustomer(cpfOwner, '529174');
    await createCustomer(cpfOther, '638271');
    const body = { phone: '(11) 98765-4321' };

    expect((await patch(`${apiBase}/customers/${cpfOwner}`, body)).status).toBe(401);

    const otherSession = await openSession(cpfOther, '638271');
    const mismatch = await patch(`${apiBase}/customers/${cpfOwner}`, body, otherSession);
    expect(mismatch.status).toBe(403);
    expect(mismatch.body.error.code).toBe('SERVICE_SESSION_CUSTOMER_MISMATCH');

    const ownerSession = await openSession(cpfOwner, '529174');
    const updated = await patch(`${apiBase}/customers/${cpfOwner}`, body, ownerSession);
    expect(updated.status).toBe(200);
    expect(updated.body.phone).toBe('11987654321');
    expect(updated.body).not.toHaveProperty('passwordHash');
  });

  it('redefine a senha no balcão, desbloqueia e encerra o atendimento aberto', async () => {
    const cpf = '39051726406';
    const { id } = await createCustomer(cpf, '417295');
    const previousSession = await openSession(cpf, '417295');
    for (let attempt = 0; attempt < 5; attempt += 1) await tryOpenSession(cpf, '111111');
    expect((await tryOpenSession(cpf, '417295')).status).toBe(423);

    const weak = await patch(`${apiBase}/customers/${cpf}/password`, {
      newCustomerPassword: '123456',
      identityConfirmed: true,
    });
    expect(weak.status).toBe(422);
    const withoutConfirmation = await patch(`${apiBase}/customers/${cpf}/password`, {
      newCustomerPassword: '583926',
    });
    expect(withoutConfirmation.status).toBe(422);

    const reset = await patch(`${apiBase}/customers/${cpf}/password`, {
      newCustomerPassword: '583926',
      identityConfirmed: true,
    });
    expect(reset.status).toBe(204);
    expect(reset.text).toBe('');

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id } });
    expect(customer.failedPasswordAttempts).toBe(0);
    expect(customer.passwordLockedUntil).toBeNull();
    expect(customer.passwordChangedAt).not.toBeNull();
    expect(customer.passwordChangedByUserId).not.toBeNull();
    expect(
      (await prisma.serviceSession.findUniqueOrThrow({ where: { id: previousSession } })).status,
    ).toBe('CLOSED');

    expect((await tryOpenSession(cpf, '417295')).status).toBe(401);
    expect((await tryOpenSession(cpf, '583926')).status).toBe(201);
  });

  it('consulta o atendimento atual com CPF mascarado e devolve 404 sem atendimento', async () => {
    const cpf = '57193604848';
    await createCustomer(cpf, '726193');
    const sessionId = await openSession(cpf, '726193');

    const current = await get(`${apiBase}/service-sessions/current`);
    expect(current.status).toBe(200);
    expect(current.body.id).toBe(sessionId);
    expect(current.body.customer.cpf).toBe('***.936.048-**');
    expect(current.body.customer).not.toHaveProperty('passwordHash');

    expect((await patch(`${apiBase}/service-sessions/${sessionId}/close`, {})).status).toBe(200);
    expect((await get(`${apiBase}/service-sessions/current`)).status).toBe(404);
  });

  it('registra bloqueio e desbloqueio da conta no histórico', async () => {
    const { accountNumber } = await createCustomer('82640315951', '819362');
    const statusPath = `${apiBase}/accounts/${accountNumber}/status`;

    expect((await patch(statusPath, { status: 'BLOCKED', reason: 'Abcd' })).status).toBe(422);
    expect(
      (await patch(statusPath, { status: 'BLOCKED', reason: 'Suspeita de fraude' })).status,
    ).toBe(200);
    expect((await patch(statusPath, { status: 'ACTIVE' })).status).toBe(200);
    const repeated = await patch(statusPath, { status: 'ACTIVE' });
    expect(repeated.status).toBe(422);
    expect(repeated.body.error.code).toBe('ACCOUNT_STATUS_UNCHANGED');

    const history = await get(`${apiBase}/accounts/${accountNumber}/status-history`);
    expect(history.status).toBe(200);
    expect(history.body.total).toBe(2);
    expect(history.body.data[0]).toMatchObject({ fromStatus: 'BLOCKED', toStatus: 'ACTIVE' });
    expect(history.body.data[1]).toMatchObject({
      fromStatus: 'ACTIVE',
      toStatus: 'BLOCKED',
      reason: 'Suspeita de fraude',
    });
    expect((await get(`${apiBase}/accounts/0000000/status-history`)).status).toBe(404);
  });

  it('recusa telefone com letras', async () => {
    const response = await post(`${apiBase}/customers`, {
      name: 'Telefone inválido',
      cpf: '14972836555',
      phone: '11abc987654',
      customerPassword: '462819',
    });
    expect(response.status).toBe(422);
  });

  it('não exclui cliente com histórico de status da conta', async () => {
    const cpf = '14972836555';
    const { accountNumber } = await createCustomer(cpf, '462819');
    const statusPath = `${apiBase}/accounts/${accountNumber}/status`;
    expect(
      (await patch(statusPath, { status: 'BLOCKED', reason: 'Conferência de cadastro' })).status,
    ).toBe(200);
    expect((await patch(statusPath, { status: 'ACTIVE' })).status).toBe(200);

    const deleted = await remove(`${apiBase}/customers/${cpf}`);
    expect(deleted.status).toBe(409);
    expect(deleted.body.error.code).toBe('CUSTOMER_HAS_HISTORY');
  });
});
