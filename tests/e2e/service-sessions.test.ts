import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { createAccessToken } from '../../src/utils/token.js';
import {
  apiBase,
  createCustomer,
  get,
  openSession,
  patch,
  post,
  setupTestDatabase,
} from './helpers.js';
import type { CreatedCustomer } from './helpers.js';

const cpfA = '52998224725';
const cpfB = '11144477735';
const cpfC = '93541134780';
let otherOperatorId = '';
let customerA: CreatedCustomer;
let customerC: CreatedCustomer;

beforeAll(async () => {
  ({ otherOperatorId } = await setupTestDatabase());
  customerA = await createCustomer({ name: 'Cliente A', cpf: cpfA, customerPassword: '291847' });
  await createCustomer({ name: 'Cliente B', cpf: cpfB, customerPassword: '847291' });
  customerC = await createCustomer({ name: 'Cliente C', cpf: cpfC, customerPassword: '275918' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('atendimentos', () => {
  it('zera as tentativas inválidas depois de uma senha correta', async () => {
    const badAttempt = await post(`${apiBase}/service-sessions`, {
      cpf: cpfC,
      customerPassword: '111111',
    });
    expect(badAttempt.status).toBe(401);
    await openSession(cpfC, '275918');
    expect(
      (await prisma.customer.findUniqueOrThrow({ where: { id: customerC.id } }))
        .failedPasswordAttempts,
    ).toBe(0);
  });

  it('encerra o atendimento anterior quando o mesmo operador abre outro', async () => {
    const sessionC = await openSession(cpfC, '275918');
    const replacementSessionC = await openSession(cpfC, '275918');
    expect(
      (await prisma.serviceSession.findUniqueOrThrow({ where: { id: sessionC } })).status,
    ).toBe('CLOSED');
    expect(
      (await patch(`${apiBase}/service-sessions/${replacementSessionC}/close`, {})).status,
    ).toBe(200);
  });

  it('bloqueia o cliente na quinta senha errada com 423', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(
        (
          await post(`${apiBase}/service-sessions`, {
            cpf: cpfC,
            customerPassword: '111111',
          })
        ).status,
      ).toBe(401);
    }
    const locked = await post(`${apiBase}/service-sessions`, {
      cpf: cpfC,
      customerPassword: '111111',
    });
    expect(locked.status).toBe(423);
  });

  it('recusa o atendimento usado por outro operador', async () => {
    const sessionA = await openSession(cpfA, '291847');
    const otherToken = await createAccessToken(otherOperatorId);
    const otherOperatorSessionUse = await request(app)
      .get(`${apiBase}/customer-service/accounts`)
      .set('Authorization', `Bearer ${otherToken}`)
      .set('X-Service-Session-Id', sessionA);
    expect(otherOperatorSessionUse.status).toBe(403);
  });

  it('recusa operação em atendimento encerrado', async () => {
    const sessionA = await openSession(cpfA, '291847');
    expect((await patch(`${apiBase}/service-sessions/${sessionA}/close`, {})).status).toBe(200);
    const closedSessionRequest = await post(
      `${apiBase}/customer-service/transactions/withdrawals`,
      { accountNumber: customerA.accountNumber, amountCents: '1' },
      sessionA,
      randomUUID(),
    );
    expect(closedSessionRequest.status).toBe(403);
  });

  it('marca como EXPIRED o atendimento vencido e recusa o uso', async () => {
    const expiringSession = await openSession(cpfB, '847291');
    await prisma.serviceSession.update({
      where: { id: expiringSession },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect((await get(`${apiBase}/customer-service/accounts`, expiringSession)).status).toBe(403);
    expect(
      (await prisma.serviceSession.findUniqueOrThrow({ where: { id: expiringSession } })).status,
    ).toBe('EXPIRED');
  });
});
