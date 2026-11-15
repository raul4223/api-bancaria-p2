import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Test } from 'supertest';
import { prisma } from '../../src/database/prisma.js';
import { env } from '../../src/config/env.js';
import {
  apiBase,
  createCustomer,
  get,
  getToken,
  openSession,
  post,
  setToken,
  setupTestDatabase,
  travelTo,
} from './helpers.js';

let accountA1Id = '';
let accountB1Id = '';
let accountA1Number = '';
let pixKeyB = '';

// Abrir um atendimento do cliente A, depositar saldo e devolver o atendimento
async function prepareTimedTransfers(): Promise<string> {
  const sessionId = await openSession('52998224725', '291847');
  const deposit = await post(
    `${apiBase}/customer-service/transactions/deposits`,
    { accountNumber: accountA1Number, amountCents: '300000' },
    sessionId,
    randomUUID(),
  );
  expect(deposit.status).toBe(201);
  return sessionId;
}

// Enviar uma transferência TED de A1 para B1 no atendimento informado
async function sendTed(sessionId: string, amountCents: string): Promise<Test> {
  const b1 = await prisma.account.findUniqueOrThrow({ where: { id: accountB1Id } });
  return post(
    `${apiBase}/customer-service/transactions/transfers`,
    {
      transferType: 'TED',
      sourceAccountNumber: accountA1Number,
      destinationAgency: b1.agency,
      destinationAccountNumber: b1.number,
      amountCents,
    },
    sessionId,
    randomUUID(),
  );
}

// Enviar uma transferência PIX de A1 para a chave de B no atendimento informado
function sendPix(sessionId: string, amountCents: string): Test {
  return post(
    `${apiBase}/customer-service/transactions/transfers`,
    { transferType: 'PIX', sourceAccountNumber: accountA1Number, pixKey: pixKeyB, amountCents },
    sessionId,
    randomUUID(),
  );
}

beforeAll(async () => {
  await setupTestDatabase();
  const customerA = await createCustomer({
    name: 'Cliente A',
    cpf: '52998224725',
    customerPassword: '291847',
  });
  const customerB = await createCustomer({
    name: 'Cliente B',
    cpf: '11144477735',
    customerPassword: '847291',
  });
  ({ accountId: accountA1Id, accountNumber: accountA1Number } = customerA);
  accountB1Id = customerB.accountId;
  const sessionB = await openSession('11144477735', '847291');
  const createPix = await post(
    `${apiBase}/customer-service/pix-keys`,
    { accountNumber: customerB.accountNumber, keyType: 'EMAIL', keyValue: 'b@example.test' },
    sessionB,
  );
  expect(createPix.status).toBe(201);
  pixKeyB = createPix.body.keyValue as string;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('horário bancário', () => {
  it('aplica horário bancário da TED e limite noturno do PIX pela API', async () => {
    const originalToken = getToken();
    vi.useFakeTimers({ toFake: ['Date'] });
    env.tedBusinessHoursEnabled = true;
    try {
      expect((await prisma.account.findUniqueOrThrow({ where: { id: accountB1Id } })).status).toBe(
        'ACTIVE',
      );

      // Sábado, 12:00 em São Paulo: TED recusada por não ser dia útil
      await travelTo('2026-11-07T15:00:00Z');
      const saturdaySession = await prepareTimedTransfers();
      const saturdayBalance = (
        await prisma.account.findUniqueOrThrow({ where: { id: accountA1Id } })
      ).balanceCents;
      const saturdayTed = await sendTed(saturdaySession, '2000');
      expect(saturdayTed.status).toBe(422);
      expect(saturdayTed.body.error.code).toBe('TED_OUTSIDE_BUSINESS_HOURS');
      expect(
        (await prisma.account.findUniqueOrThrow({ where: { id: accountA1Id } })).balanceCents,
      ).toBe(saturdayBalance);

      // Segunda-feira, 18:00 em São Paulo: TED recusada depois do horário
      await travelTo('2026-11-09T21:00:00Z');
      const lateSession = await prepareTimedTransfers();
      const lateTed = await sendTed(lateSession, '2000');
      expect(lateTed.status).toBe(422);
      expect(lateTed.body.error.code).toBe('TED_OUTSIDE_BUSINESS_HOURS');

      // Segunda-feira, 22:00 em São Paulo: PIX noturno acima do limite é recusado
      await travelTo('2026-11-10T01:00:00Z');
      const nightSession = await prepareTimedTransfers();
      const nightPixAbove = await sendPix(nightSession, '100001');
      expect(nightPixAbove.status).toBe(422);
      expect(nightPixAbove.body.error.code).toBe('PIX_NIGHT_LIMIT_EXCEEDED');
      const nightPixBelow = await sendPix(nightSession, '100000');
      expect(nightPixBelow.status).toBe(201);

      // Terça-feira, 10:00 em São Paulo: TED aceita com tarifa e PIX sem limite noturno
      await travelTo('2026-11-10T13:00:00Z');
      const daySession = await prepareTimedTransfers();
      const dayTed = await sendTed(daySession, '2000');
      expect(dayTed.status).toBe(201);
      expect(dayTed.body.feeCents).toBe(env.tedFeeCents.toString());
      const dayPix = await sendPix(daySession, '150000');
      expect(dayPix.status).toBe(201);

      // Regra de horário desligada: TED aceita mesmo no fim de semana
      env.tedBusinessHoursEnabled = false;
      await travelTo('2026-11-07T15:00:00Z');
      const disabledSession = await prepareTimedTransfers();
      expect((await sendTed(disabledSession, '2000')).status).toBe(201);

      expect((await get(`${apiBase}/ledger/reconciliation`)).body.balanced).toBe(true);
    } finally {
      env.tedBusinessHoursEnabled = false;
      vi.useRealTimers();
      setToken(originalToken);
    }
  });
});
