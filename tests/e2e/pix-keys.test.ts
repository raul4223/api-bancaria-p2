import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/database/prisma.js';
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
import type { CreatedCustomer } from './helpers.js';

const pixKeys = `${apiBase}/customer-service/pix-keys`;
let customerA: CreatedCustomer;
let customerB: CreatedCustomer;
let sessionBId = '';
let accountB2Number = '';
let pixKeyBId = '';
let randomKeyId = '';

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
  sessionBId = await openSession('11144477735', '847291');
  ({ number: accountB2Number } = await openAccount(sessionBId, 'SAVINGS'));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('chaves Pix', () => {
  it('cadastra chave de e-mail', async () => {
    const createPix = await post(
      pixKeys,
      { accountNumber: customerB.accountNumber, keyType: 'EMAIL', keyValue: 'b@example.test' },
      sessionBId,
    );
    expect(createPix.status).toBe(201);
    pixKeyBId = createPix.body.id as string;
  });

  it('gera chave aleatória no servidor e lista as chaves do cliente', async () => {
    const randomKey = await post(
      pixKeys,
      { accountNumber: accountB2Number, keyType: 'RANDOM' },
      sessionBId,
    );
    expect(randomKey.status).toBe(201);
    expect(randomKey.body.keyValue).toBeTruthy();
    randomKeyId = randomKey.body.id as string;
    const pixList = await get(pixKeys, sessionBId);
    expect(pixList.body.total).toBe(2);
    expect((await get(`${pixKeys}/${randomKeyId}`, sessionBId)).status).toBe(200);
  });

  it('move a chave para outra conta do mesmo cliente', async () => {
    const movePix = await patch(
      `${pixKeys}/${randomKeyId}`,
      { accountNumber: customerB.accountNumber },
      sessionBId,
    );
    expect(movePix.status).toBe(200);
    expect(movePix.body.accountId).toBe(customerB.accountId);
    expect((await get(`${pixKeys}/${randomKeyId}`, sessionBId)).body.accountId).toBe(
      customerB.accountId,
    );
  });

  it('exclui a chave', async () => {
    expect((await remove(`${pixKeys}/${randomKeyId}`, sessionBId)).status).toBe(204);
    expect((await get(`${pixKeys}/${randomKeyId}`, sessionBId)).status).toBe(404);
  });

  it('recusa chave CPF de outra pessoa', async () => {
    const wrongCpfKey = await post(
      pixKeys,
      { accountNumber: customerB.accountNumber, keyType: 'CPF', keyValue: '52998224725' },
      sessionBId,
    );
    expect(wrongCpfKey.status).toBe(422);
  });

  it('recusa chave duplicada', async () => {
    const duplicateKey = await post(
      pixKeys,
      { accountNumber: customerB.accountNumber, keyType: 'EMAIL', keyValue: 'b@example.test' },
      sessionBId,
    );
    expect(duplicateKey.status).toBe(409);
  });

  it('aceita no máximo cinco chaves por conta', async () => {
    for (let index = 0; index < 4; index += 1) {
      expect(
        (
          await post(
            pixKeys,
            { accountNumber: customerB.accountNumber, keyType: 'RANDOM' },
            sessionBId,
          )
        ).status,
      ).toBe(201);
    }
    const pixKeyLimit = await post(
      pixKeys,
      { accountNumber: customerB.accountNumber, keyType: 'RANDOM' },
      sessionBId,
    );
    expect(pixKeyLimit.status).toBe(422);
  });

  it('encerra o atendimento do cliente B', async () => {
    expect((await patch(`${apiBase}/service-sessions/${sessionBId}/close`, {})).status).toBe(200);
  });

  it('responde 404 ao consultar, mover ou excluir chave de outro cliente', async () => {
    const sessionAId = await openSession('52998224725', '291847');
    expect((await get(`${pixKeys}/${pixKeyBId}`, sessionAId)).status).toBe(404);
    expect(
      (
        await patch(
          `${pixKeys}/${pixKeyBId}`,
          { accountNumber: customerA.accountNumber },
          sessionAId,
        )
      ).status,
    ).toBe(404);
    expect((await remove(`${pixKeys}/${pixKeyBId}`, sessionAId)).status).toBe(404);
  });

  it('move e exclui chave própria entre as contas do cliente', async () => {
    const sessionAId = await openSession('52998224725', '291847');
    const { number: accountA2Number } = await openAccount(sessionAId, 'SAVINGS');
    const ownPixKey = await post(
      pixKeys,
      { accountNumber: accountA2Number, keyType: 'EMAIL', keyValue: 'a@example.test' },
      sessionAId,
    );
    expect(ownPixKey.status).toBe(201);
    expect(
      (
        await patch(
          `${pixKeys}/${ownPixKey.body.id}`,
          { accountNumber: customerA.accountNumber },
          sessionAId,
        )
      ).status,
    ).toBe(200);
    expect((await remove(`${pixKeys}/${ownPixKey.body.id}`, sessionAId)).status).toBe(204);
  });
});
