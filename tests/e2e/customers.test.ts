import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Response } from 'supertest';
import { prisma } from '../../src/database/prisma.js';
import { apiBase, get, openSession, patch, post, remove, setupTestDatabase } from './helpers.js';

const cpfA = '52998224725';
const cpfB = '11144477735';
let customerAId = '';

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('CRUD de clientes', () => {
  it('recusa CPF inválido', async () => {
    const invalidCpf = await post(`${apiBase}/customers`, {
      name: 'Inválido',
      cpf: '11111111111',
      customerPassword: '291847',
    });
    expect(invalidCpf.status).toBe(422);
  });

  it('recusa senha de atendimento fraca', async () => {
    const weakPassword = await post(`${apiBase}/customers`, {
      name: 'Inválido',
      cpf: '12345678909',
      customerPassword: '123456',
    });
    expect(weakPassword.status).toBe(422);
  });

  it('cadastra clientes já com uma conta corrente zerada e sem expor hash', async () => {
    const createA = await post(`${apiBase}/customers`, {
      name: 'Cliente A',
      cpf: cpfA,
      email: 'a@example.test',
      customerPassword: '291847',
    });
    const createB = await post(`${apiBase}/customers`, {
      name: 'Cliente B',
      cpf: cpfB,
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
    for (const created of [createA, createB, createC] as Response[]) {
      expect(created.body.accounts).toHaveLength(1);
      expect(created.body.accounts[0]).toMatchObject({
        agency: '0001',
        type: 'CHECKING',
        status: 'ACTIVE',
        balanceCents: '0',
      });
      expect(created.body.accounts[0].number).toMatch(/^\d{7}$/);
    }
  });

  it('recusa e-mail duplicado', async () => {
    const duplicateEmail = await post(`${apiBase}/customers`, {
      name: 'E-mail duplicado',
      cpf: '12345678909',
      email: 'a@example.test',
      customerPassword: '736194',
    });
    expect(duplicateEmail.status).toBe(409);
  });

  it('recusa CPF duplicado com DUPLICATE_CUSTOMER', async () => {
    const duplicate = await post(`${apiBase}/customers`, {
      name: 'Duplicado',
      cpf: cpfA,
      customerPassword: '291847',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_CUSTOMER');
  });

  it('lista clientes com CPF mascarado e sem hash', async () => {
    const list = await get(`${apiBase}/customers`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');
    expect(list.body.data.find((customer: { id: string }) => customer.id === customerAId).cpf).toBe(
      '***.982.247-**',
    );
  });

  it('filtra clientes por nome e por CPF', async () => {
    expect(
      (await get(`${apiBase}/customers?search=Cliente%20A`)).body.data.map(
        (customer: { id: string }) => customer.id,
      ),
    ).toContain(customerAId);
    expect(
      (await get(`${apiBase}/customers?cpf=${cpfA}`)).body.data.map(
        (customer: { id: string }) => customer.id,
      ),
    ).toEqual([customerAId]);
  });

  it('mostra o detalhe pelo CPF com o CPF completo e sem hash', async () => {
    expect((await get(`${apiBase}/customers/${cpfB}`)).status).toBe(200);
    const detail = await get(`${apiBase}/customers/${cpfA}`);
    expect(detail.body.cpf).toBe(cpfA);
    expect(detail.body).not.toHaveProperty('passwordHash');
  });

  it('exige atendimento do mesmo cliente para alterar o cadastro', async () => {
    const updateWithoutSession = await patch(`${apiBase}/customers/${cpfA}`, {
      name: 'Cliente A Atualizado',
    });
    expect(updateWithoutSession.status).toBe(401);
    const sessionOfB = await openSession(cpfB, '847291');
    const updateWithOtherCustomer = await patch(
      `${apiBase}/customers/${cpfA}`,
      { name: 'Cliente A Atualizado' },
      sessionOfB,
    );
    expect(updateWithOtherCustomer.status).toBe(403);
    expect(updateWithOtherCustomer.body.error.code).toBe('SERVICE_SESSION_CUSTOMER_MISMATCH');
  });

  it('altera o cadastro com atendimento do próprio cliente', async () => {
    const sessionOfA = await openSession(cpfA, '291847');
    const updated = await patch(
      `${apiBase}/customers/${cpfA}`,
      { name: 'Cliente A Atualizado' },
      sessionOfA,
    );
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Cliente A Atualizado');
  });

  it('exclui cadastro feito por engano junto com a conta aberta', async () => {
    const createTemporary = await post(`${apiBase}/customers`, {
      name: 'Cadastro Temporário',
      cpf: '12345678909',
      customerPassword: '736194',
      accountType: 'SAVINGS',
    });
    expect(createTemporary.status).toBe(201);
    expect(createTemporary.body.accounts[0].type).toBe('SAVINGS');
    const temporaryAccountId = createTemporary.body.accounts[0].id as string;
    expect((await get(`${apiBase}/customers/123.456.789-09`)).body.name).toBe(
      'Cadastro Temporário',
    );
    expect((await get(`${apiBase}/customers/${createTemporary.body.id}`)).status).toBe(422);
    expect((await remove(`${apiBase}/customers/12345678909`)).status).toBe(204);
    expect(await prisma.account.findUnique({ where: { id: temporaryAccountId } })).toBeNull();
    expect((await get(`${apiBase}/customers/12345678909`)).status).toBe(404);
    expect((await remove(`${apiBase}/customers/12345678909`)).status).toBe(404);
  });
});
