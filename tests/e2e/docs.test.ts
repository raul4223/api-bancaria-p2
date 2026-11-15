import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('documentação e health', () => {
  it('expõe Swagger, OpenAPI, health e as rotas documentadas', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/docs/')).status).toBe(200);
    const response = await request(app).get('/openapi.json');
    expect(response.status).toBe(200);
    const operations = Object.values(
      response.body.paths as Record<string, Record<string, unknown>>,
    ).flatMap((path) => Object.keys(path));
    expect(operations).toHaveLength(33);
    expect(response.body.components.securitySchemes.bearerAuth).toBeDefined();
    expect(response.body.components.securitySchemes.serviceSession).toBeDefined();
    expect(
      response.body.paths['/api/v1/customer-service/transactions/transfers'].post.requestBody
        .content['application/json'].examples,
    ).toHaveProperty('pix');
    expect(
      response.body.paths['/api/v1/customer-service/transactions/transfers'].post.requestBody
        .content['application/json'].examples,
    ).toHaveProperty('ted');
    expect(
      response.body.paths['/api/v1/customer-service/transactions/transfers'].post.requestBody
        .content['application/json'].examples,
    ).toHaveProperty('internal');
    expect(
      response.body.paths['/api/v1/customer-service/transactions/transfers'].post.responses['200'],
    ).toBeDefined();
  });
});
