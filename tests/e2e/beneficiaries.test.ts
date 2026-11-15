import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  remove,
  setupTestDatabase,
} from './helpers.js';
import type { CreatedCustomer } from './helpers.js';

const beneficiaries = `${apiBase}/customer-service/beneficiaries`;
let otherOperatorId = '';
let customerA: CreatedCustomer;
let customerB: CreatedCustomer;
let sessionAId = '';
let beneficiaryId = '';

beforeAll(async () => {
  ({ otherOperatorId } = await setupTestDatabase());
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
  sessionAId = await openSession('52998224725', '291847');
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Tentar cadastrar favorecido TED no atendimento do cliente A
function postTedBeneficiary(nickname: string, agency: string, accountNumber: string) {
  return post(
    beneficiaries,
    {
      nickname,
      transferType: 'TED',
      destinationAgency: agency,
      destinationAccountNumber: accountNumber,
    },
    sessionAId,
  );
}

describe('favorecidos', () => {
  it('isola o favorecido de outro cliente, mesmo cadastrado por outro operador', async () => {
    const otherToken = await createAccessToken(otherOperatorId);
    const sessionBForSecondOperator = await request(app)
      .post(`${apiBase}/service-sessions`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ cpf: '11144477735', customerPassword: '847291' });
    expect(sessionBForSecondOperator.status).toBe(201);
    const beneficiaryB = await request(app)
      .post(beneficiaries)
      .set('Authorization', `Bearer ${otherToken}`)
      .set('X-Service-Session-Id', sessionBForSecondOperator.body.id as string)
      .send({
        nickname: 'Cliente A',
        transferType: 'TED',
        destinationAgency: '0001',
        destinationAccountNumber: customerA.accountNumber,
      });
    expect(beneficiaryB.status).toBe(201);
    const beneficiaryBId = beneficiaryB.body.id as string;
    expect((await get(`${beneficiaries}/${beneficiaryBId}`, sessionAId)).status).toBe(404);
    expect(
      (
        await patch(
          `${beneficiaries}/${beneficiaryBId}`,
          { nickname: 'Alterado indevidamente' },
          sessionAId,
        )
      ).status,
    ).toBe(404);
    expect((await remove(`${beneficiaries}/${beneficiaryBId}`, sessionAId)).status).toBe(404);
    expect((await get(beneficiaries, sessionAId)).body.total).toBe(0);
    expect(
      (
        await request(app)
          .patch(`${apiBase}/service-sessions/${sessionBForSecondOperator.body.id}/close`)
          .set('Authorization', `Bearer ${otherToken}`)
          .send({})
      ).status,
    ).toBe(200);
  });

  it('recusa conta própria, SYSTEM e destinos inexistentes', async () => {
    expect(
      (await postTedBeneficiary('Conta própria', '0001', customerA.accountNumber)).status,
    ).toBe(422);
    expect((await postTedBeneficiary('Conta interna', '0000', 'SYSTEM')).status).toBe(422);
    expect((await postTedBeneficiary('Destino ausente', '0001', '9999999')).status).toBe(422);
    const missingPixBeneficiary = await post(
      beneficiaries,
      { nickname: 'Chave ausente', transferType: 'PIX', pixKey: 'missing@example.test' },
      sessionAId,
    );
    expect(missingPixBeneficiary.status).toBe(422);
  });

  it('cadastra, lista e consulta favorecido TED', async () => {
    const beneficiary = await postTedBeneficiary('Cliente B', '0001', customerB.accountNumber);
    expect(beneficiary.status).toBe(201);
    beneficiaryId = beneficiary.body.id as string;
    expect((await get(beneficiaries, sessionAId)).body.total).toBe(1);
    expect((await get(`${beneficiaries}/${beneficiaryId}`, sessionAId)).status).toBe(200);
  });

  it('altera o apelido do favorecido', async () => {
    const updatedBeneficiary = await patch(
      `${beneficiaries}/${beneficiaryId}`,
      { nickname: 'Favorecido B' },
      sessionAId,
    );
    expect(updatedBeneficiary.body.nickname).toBe('Favorecido B');
    expect((await get(`${beneficiaries}/${beneficiaryId}`, sessionAId)).body.nickname).toBe(
      'Favorecido B',
    );
  });

  it('recusa trocar o destino para conta própria sem alterar o favorecido', async () => {
    const invalidBeneficiaryUpdate = await patch(
      `${beneficiaries}/${beneficiaryId}`,
      { destinationAgency: '0001', destinationAccountNumber: customerA.accountNumber },
      sessionAId,
    );
    expect(invalidBeneficiaryUpdate.status).toBe(422);
    expect((await get(`${beneficiaries}/${beneficiaryId}`, sessionAId)).body.nickname).toBe(
      'Favorecido B',
    );
  });

  it('exclui o favorecido', async () => {
    expect((await remove(`${beneficiaries}/${beneficiaryId}`, sessionAId)).status).toBe(204);
    expect((await get(`${beneficiaries}/${beneficiaryId}`, sessionAId)).status).toBe(404);
  });
});
