import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { hashPassword } from '../../src/utils/password.js';
import { createAccessToken } from '../../src/utils/token.js';

const apiBase = '/api/v1';
const createdOperatorIds: string[] = [];
let activeOperatorToken = '';
let inactiveOperatorToken = '';

// Criar um operador de teste com o estado de ativação informado
async function createOperator(isActive: boolean): Promise<string> {
  const operator = await prisma.user.create({
    data: {
      name: isActive ? 'Operador Ativo de Teste' : 'Operador Desativado de Teste',
      email: `operador-${randomUUID()}@example.test`,
      passwordHash: await hashPassword('OperatorPassword!123'),
      isActive,
    },
  });
  createdOperatorIds.push(operator.id);
  return operator.id;
}

beforeAll(async () => {
  activeOperatorToken = await createAccessToken(await createOperator(true));
  inactiveOperatorToken = await createAccessToken(await createOperator(false));
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdOperatorIds } } });
  await prisma.$disconnect();
});

describe('tratamento de erros HTTP', () => {
  it('responde 400 INVALID_JSON para corpo malformado', async () => {
    const response = await request(app)
      .post(`${apiBase}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('responde 413 PAYLOAD_TOO_LARGE para corpo acima de 100kb', async () => {
    const response = await request(app)
      .post(`${apiBase}/auth/login`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(110 * 1024), password: 'x' }));
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('responde 404 ROUTE_NOT_FOUND em JSON para rota inexistente', async () => {
    const response = await request(app).get(`${apiBase}/nao-existe`);
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('aceita o token de um operador ativo', async () => {
    const response = await request(app)
      .get(`${apiBase}/customers`)
      .set('Authorization', `Bearer ${activeOperatorToken}`);
    expect(response.status).toBe(200);
  });

  it('responde 401 para token de operador desativado', async () => {
    const response = await request(app)
      .get(`${apiBase}/customers`)
      .set('Authorization', `Bearer ${inactiveOperatorToken}`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
