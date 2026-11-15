import { expect, vi } from 'vitest';
import request from 'supertest';
import type { Test } from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { env } from '../../src/config/env.js';
import { hashPassword } from '../../src/utils/password.js';
import { createAccessToken } from '../../src/utils/token.js';

export const apiBase = '/api/v1';
export const operatorEmail = 'operator@example.test';
export const operatorPassword = 'AdminPassword!123';

export type CreatedCustomer = { id: string; accountId: string; accountNumber: string };

let token = '';

// Devolver o JWT atual do operador padrão
export function getToken(): string {
  return token;
}

// Trocar o JWT usado pelos helpers de requisição
export function setToken(value: string): void {
  token = value;
}

// Criar requisição GET autenticada com atendimento opcional
export function get(path: string, sessionId?: string): Test {
  let call = request(app).get(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  return call;
}

// Criar requisição POST autenticada com atendimento e idempotência opcionais
export function post(
  path: string,
  body: object,
  sessionId?: string,
  idempotencyKey?: string,
): Test {
  let call = request(app).post(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  if (idempotencyKey) call = call.set('Idempotency-Key', idempotencyKey);
  return call.send(body);
}

// Criar requisição PATCH autenticada com atendimento opcional
export function patch(path: string, body: object, sessionId?: string): Test {
  let call = request(app).patch(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  return call.send(body);
}

// Criar requisição DELETE autenticada com atendimento opcional
export function remove(path: string, sessionId?: string): Test {
  let call = request(app).delete(path).set('Authorization', `Bearer ${token}`);
  if (sessionId) call = call.set('X-Service-Session-Id', sessionId);
  return call;
}

// Abrir atendimento e devolver seu identificador
export async function openSession(cpf: string, customerPassword: string): Promise<string> {
  const response = await post(`${apiBase}/service-sessions`, { cpf, customerPassword });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.id as string;
}

// Abrir conta corrente ou poupança no atendimento e devolver ID e número
export async function openAccount(
  sessionId: string,
  type: 'CHECKING' | 'SAVINGS',
): Promise<{ id: string; number: string }> {
  const response = await post(`${apiBase}/customer-service/accounts`, { type }, sessionId);
  expect(response.status).toBe(201);
  expect(response.body.agency).toBe('0001');
  expect(response.body.number).toMatch(/^\d{7}$/);
  return { id: response.body.id as string, number: response.body.number as string };
}

// Cadastrar cliente pela API e devolver o cliente e a primeira conta
export async function createCustomer(input: {
  name: string;
  cpf: string;
  customerPassword: string;
  email?: string;
}): Promise<CreatedCustomer> {
  const response = await post(`${apiBase}/customers`, input);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return {
    id: response.body.id as string,
    accountId: response.body.accounts[0].id as string,
    accountNumber: response.body.accounts[0].number as string,
  };
}

// Simular a data e hora do banco e renovar o JWT do operador nesse horário
export async function travelTo(isoDate: string): Promise<void> {
  vi.setSystemTime(new Date(isoDate));
  const operator = await prisma.user.findUniqueOrThrow({ where: { email: operatorEmail } });
  token = await createAccessToken(operator.id);
}

// Limpar exclusivamente o banco de teste em ordem segura de chaves estrangeiras
export async function clearTestDatabase(): Promise<void> {
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

// Limpar o banco de teste, criar a conta SYSTEM e os operadores e autenticar o operador padrão
export async function setupTestDatabase(): Promise<{
  operatorId: string;
  otherOperatorId: string;
}> {
  await prisma.$connect();
  // Manter o limite diário fora do caminho dos fluxos destes arquivos
  env.dailyTransferLimitCents = 1_000_000_000n;
  await clearTestDatabase();
  await prisma.account.create({
    data: { agency: '0000', number: 'SYSTEM', type: 'SYSTEM', balanceCents: 0n },
  });
  const operator = await prisma.user.create({
    data: {
      name: 'Operador de Teste',
      email: operatorEmail,
      passwordHash: await hashPassword(operatorPassword),
    },
  });
  const otherOperator = await prisma.user.create({
    data: {
      name: 'Segundo Operador',
      email: 'operator-two@example.test',
      passwordHash: await hashPassword('SecondPassword!123'),
    },
  });
  token = await createAccessToken(operator.id);
  return { operatorId: operator.id, otherOperatorId: otherOperator.id };
}
