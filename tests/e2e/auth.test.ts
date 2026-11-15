import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { SignJWT } from 'jose';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { env } from '../../src/config/env.js';
import { apiBase, operatorEmail, operatorPassword, setupTestDatabase } from './helpers.js';

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Assinar um JWT de teste com o segredo e a expiração informados
function signTestToken(secret: string, expiration: string | number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('11111111-1111-4111-8111-111111111111')
    .setIssuer(env.jwtIssuer)
    .setAudience(env.jwtAudience)
    .setExpirationTime(expiration)
    .sign(new TextEncoder().encode(secret));
}

describe('autenticação do operador', () => {
  it('recusa login com senha incorreta', async () => {
    const invalidLogin = await request(app)
      .post(`${apiBase}/auth/login`)
      .send({ email: operatorEmail, password: 'incorreta' });
    expect(invalidLogin.status).toBe(401);
  });

  it('recusa rota protegida sem token', async () => {
    const noToken = await request(app).get(`${apiBase}/customers`);
    expect(noToken.status).toBe(401);
  });

  it('recusa token malformado', async () => {
    const invalidToken = await request(app)
      .get(`${apiBase}/customers`)
      .set('Authorization', 'Bearer token-inválido');
    expect(invalidToken.status).toBe(401);
  });

  it('recusa token expirado', async () => {
    const expiredToken = await signTestToken(env.jwtSecret, Math.floor(Date.now() / 1000) - 60);
    expect(
      (
        await request(app)
          .get(`${apiBase}/customers`)
          .set('Authorization', `Bearer ${expiredToken}`)
      ).status,
    ).toBe(401);
  });

  it('recusa token assinado com outro segredo', async () => {
    const wrongSecretToken = await signTestToken(
      'different-secret-that-is-at-least-32-characters',
      '60m',
    );
    expect(
      (
        await request(app)
          .get(`${apiBase}/customers`)
          .set('Authorization', `Bearer ${wrongSecretToken}`)
      ).status,
    ).toBe(401);
  });

  it('autentica o operador e devolve token Bearer', async () => {
    const login = await request(app)
      .post(`${apiBase}/auth/login`)
      .send({ email: operatorEmail, password: operatorPassword });
    expect(login.status).toBe(200);
    expect(login.body.tokenType).toBe('Bearer');
    const withLoginToken = await request(app)
      .get(`${apiBase}/customers`)
      .set('Authorization', `Bearer ${login.body.accessToken as string}`);
    expect(withLoginToken.status).toBe(200);
  });
});
