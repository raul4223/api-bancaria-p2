import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/database/prisma.js';
import {
  apiBase,
  createCustomer,
  get,
  openAccount,
  openSession,
  patch,
  setupTestDatabase,
} from './helpers.js';
import type { CreatedCustomer } from './helpers.js';

let customerA: CreatedCustomer;
let customerB: CreatedCustomer;
let sessionAId = '';

beforeAll(async () => {
  await setupTestDatabase();
  customerA = await createCustomer({
    name: 'Cliente A',
    cpf: '52998224725',
    customerPassword: '291847',
  });
  customerB = await createCustomer({
    name: 'Cliente B',
    cpf: '11144477735',
    customerPassword: '847291',
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('contas', () => {
  it('abre conta poupança no atendimento do cliente', async () => {
    const sessionBId = await openSession('11144477735', '847291');
    await openAccount(sessionBId, 'SAVINGS');
  });

  it('abre a segunda conta com saldo zero e número diferente da primeira', async () => {
    sessionAId = await openSession('52998224725', '291847');
    const accountA2 = await openAccount(sessionAId, 'SAVINGS');
    expect((await get(`${apiBase}/customer-service/accounts`, sessionAId)).body.total).toBe(2);
    const [accountA1, storedA2] = await Promise.all([
      prisma.account.findUniqueOrThrow({ where: { id: customerA.accountId } }),
      prisma.account.findUniqueOrThrow({ where: { id: accountA2.id } }),
    ]);
    expect(accountA1.balanceCents).toBe(0n);
    expect(storedA2.balanceCents).toBe(0n);
    expect(accountA1.number).not.toBe(storedA2.number);
  });

  it('não mostra a conta de outro cliente no atendimento', async () => {
    expect(
      (await get(`${apiBase}/customer-service/accounts/${customerB.accountNumber}`, sessionAId))
        .status,
    ).toBe(404);
  });

  it('recusa consultar a conta SYSTEM e responde 404 para número inexistente', async () => {
    const systemAccount = await prisma.account.findFirstOrThrow({ where: { type: 'SYSTEM' } });
    expect(
      (await get(`${apiBase}/customer-service/accounts/${systemAccount.number}`, sessionAId))
        .status,
    ).toBe(422);
    expect((await get(`${apiBase}/customer-service/accounts/0000000`, sessionAId)).status).toBe(
      404,
    );
  });

  it('não permite bloquear a conta SYSTEM pela rota', async () => {
    const systemAccount = await prisma.account.findFirstOrThrow({ where: { type: 'SYSTEM' } });
    expect(
      (
        await patch(`${apiBase}/accounts/${systemAccount.number}/status`, {
          status: 'BLOCKED',
          reason: 'Teste inválido',
        })
      ).status,
    ).toBe(422);
  });

  it('bloqueia e desbloqueia a conta de um cliente', async () => {
    expect(
      (
        await patch(`${apiBase}/accounts/${customerB.accountNumber}/status`, {
          status: 'BLOCKED',
          reason: 'Conferência acadêmica',
        })
      ).status,
    ).toBe(200);
    expect(
      (await patch(`${apiBase}/accounts/${customerB.accountNumber}/status`, { status: 'ACTIVE' }))
        .status,
    ).toBe(200);
  });
});
