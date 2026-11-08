import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from '../schemas/zodOpenApi.js';
import { loginSchema } from '../schemas/auth.schemas.js';
import {
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from '../schemas/customer.schemas.js';
import { openServiceSessionSchema } from '../schemas/service-session.schemas.js';
import {
  accountIdParamsSchema,
  customerIdParamsSchema,
  idempotencyHeaderSchema,
  recordIdParamsSchema,
  sessionIdParamsSchema,
} from '../schemas/common.schemas.js';
import {
  listAccountsSchema,
  openAccountSchema,
  updateAccountStatusSchema,
} from '../schemas/account.schemas.js';
import {
  depositSchema,
  statementQuerySchema,
  transferSchema,
  withdrawalSchema,
} from '../schemas/transaction.schemas.js';
import {
  createPixKeySchema,
  listPixKeysSchema,
  updatePixKeySchema,
} from '../schemas/pix-key.schemas.js';
import {
  createBeneficiarySchema,
  listBeneficiariesSchema,
  updateBeneficiarySchema,
} from '../schemas/beneficiary.schemas.js';

const registry = new OpenAPIRegistry();
const errorResponse = {
  description: 'Erro validado da API',
  content: {
    'application/json': {
      schema: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
    },
  },
};
const successResponse = {
  description: 'Operação concluída',
  content: { 'application/json': { schema: z.object({}).passthrough() } },
};
const bearerSecurity = [{ bearerAuth: [] }];
const serviceSecurity = [{ bearerAuth: [], serviceSession: [] }];
const serviceHeader = z.object({ 'X-Service-Session-Id': z.string().uuid() });
const movementHeaders = idempotencyHeaderSchema.extend({
  'X-Service-Session-Id': z.string().uuid(),
});

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});
registry.registerComponent('securitySchemes', 'serviceSession', {
  type: 'apiKey',
  in: 'header',
  name: 'X-Service-Session-Id',
});

// Registrar operação OpenAPI com schema de entrada e camada de autorização
function registerRoute(definition: {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  tag: string;
  summary: string;
  operationType: 'geral' | 'atendimento' | 'público';
  body?: z.ZodType;
  params?: z.ZodObject;
  query?: z.ZodObject;
  sessionHeader?: boolean;
  idempotencyHeader?: boolean;
  successCode?: number;
  noContent?: boolean;
}): void {
  const request = {
    ...(definition.body
      ? { body: { required: true, content: { 'application/json': { schema: definition.body } } } }
      : {}),
    ...(definition.params ? { params: definition.params } : {}),
    ...(definition.query ? { query: definition.query } : {}),
    ...(definition.sessionHeader
      ? { headers: definition.idempotencyHeader ? movementHeaders : serviceHeader }
      : {}),
  };
  const security =
    definition.operationType === 'público'
      ? undefined
      : definition.operationType === 'atendimento'
        ? serviceSecurity
        : bearerSecurity;
  const successCode = definition.successCode ?? 200;
  registry.registerPath({
    method: definition.method,
    path: `/api/v1${definition.path}`,
    tags: [definition.tag],
    summary: definition.summary,
    description: `Tipo de operação: ${definition.operationType}.`,
    ...(security ? { security } : {}),
    ...(Object.keys(request).length > 0 ? { request } : {}),
    responses: {
      ...(definition.idempotencyHeader ? { 200: successResponse } : {}),
      [successCode]: definition.noContent
        ? { description: 'Registro excluído sem corpo.' }
        : successResponse,
      default: errorResponse,
    },
  });
}

registerRoute({
  method: 'post',
  path: '/auth/login',
  tag: 'Autenticação',
  summary: 'Autenticar operador master',
  operationType: 'público',
  body: loginSchema,
});
registerRoute({
  method: 'post',
  path: '/customers',
  tag: 'Clientes',
  summary: 'Cadastrar cliente',
  operationType: 'geral',
  body: createCustomerSchema,
  successCode: 201,
});
registerRoute({
  method: 'get',
  path: '/customers',
  tag: 'Clientes',
  summary: 'Listar clientes com CPF mascarado',
  operationType: 'geral',
  query: listCustomersSchema,
});
registerRoute({
  method: 'get',
  path: '/customers/{customerId}',
  tag: 'Clientes',
  summary: 'Consultar cliente por ID',
  operationType: 'geral',
  params: customerIdParamsSchema,
});
registerRoute({
  method: 'patch',
  path: '/customers/{customerId}',
  tag: 'Clientes',
  summary: 'Atualizar dados de contato',
  operationType: 'geral',
  params: customerIdParamsSchema,
  body: updateCustomerSchema,
});
registerRoute({
  method: 'delete',
  path: '/customers/{customerId}',
  tag: 'Clientes',
  summary: 'Excluir cadastro sem histórico',
  operationType: 'geral',
  params: customerIdParamsSchema,
  successCode: 204,
  noContent: true,
});
registerRoute({
  method: 'post',
  path: '/service-sessions',
  tag: 'Atendimento',
  summary: 'Abrir atendimento com senha do cliente',
  operationType: 'geral',
  body: openServiceSessionSchema,
  successCode: 201,
});
registerRoute({
  method: 'patch',
  path: '/service-sessions/{serviceSessionId}/close',
  tag: 'Atendimento',
  summary: 'Fechar atendimento',
  operationType: 'geral',
  params: sessionIdParamsSchema,
});
registerRoute({
  method: 'post',
  path: '/customer-service/accounts',
  tag: 'Contas',
  summary: 'Abrir conta do cliente atendido',
  operationType: 'atendimento',
  body: openAccountSchema,
  sessionHeader: true,
  successCode: 201,
});
registerRoute({
  method: 'get',
  path: '/customer-service/accounts',
  tag: 'Contas',
  summary: 'Listar contas do cliente atendido',
  operationType: 'atendimento',
  query: listAccountsSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'get',
  path: '/customer-service/accounts/{accountId}',
  tag: 'Contas',
  summary: 'Consultar conta do cliente atendido',
  operationType: 'atendimento',
  params: accountIdParamsSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'patch',
  path: '/accounts/{accountId}/status',
  tag: 'Contas',
  summary: 'Bloquear ou desbloquear conta',
  operationType: 'geral',
  params: accountIdParamsSchema,
  body: updateAccountStatusSchema,
});
registerRoute({
  method: 'get',
  path: '/ledger/reconciliation',
  tag: 'Ledger',
  summary: 'Conciliar saldos e lançamentos',
  operationType: 'geral',
});
registerRoute({
  method: 'post',
  path: '/customer-service/transactions/deposits',
  tag: 'Movimentações',
  summary: 'Depositar em conta do cliente',
  operationType: 'atendimento',
  body: depositSchema,
  sessionHeader: true,
  idempotencyHeader: true,
  successCode: 201,
});
registerRoute({
  method: 'post',
  path: '/customer-service/transactions/withdrawals',
  tag: 'Movimentações',
  summary: 'Sacar de conta do cliente',
  operationType: 'atendimento',
  body: withdrawalSchema,
  sessionHeader: true,
  idempotencyHeader: true,
  successCode: 201,
});
registerRoute({
  method: 'post',
  path: '/customer-service/transactions/transfers',
  tag: 'Movimentações',
  summary: 'Transferir por PIX, TED ou entre contas do mesmo titular',
  operationType: 'atendimento',
  body: transferSchema,
  sessionHeader: true,
  idempotencyHeader: true,
  successCode: 201,
});
registerRoute({
  method: 'get',
  path: '/customer-service/accounts/{accountId}/statement',
  tag: 'Movimentações',
  summary: 'Consultar extrato paginado da conta',
  operationType: 'atendimento',
  params: accountIdParamsSchema,
  query: statementQuerySchema,
  sessionHeader: true,
});
registerRoute({
  method: 'post',
  path: '/customer-service/pix-keys',
  tag: 'Chaves Pix',
  summary: 'Cadastrar chave Pix',
  operationType: 'atendimento',
  body: createPixKeySchema,
  sessionHeader: true,
  successCode: 201,
});
registerRoute({
  method: 'get',
  path: '/customer-service/pix-keys',
  tag: 'Chaves Pix',
  summary: 'Listar chaves Pix',
  operationType: 'atendimento',
  query: listPixKeysSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'get',
  path: '/customer-service/pix-keys/{id}',
  tag: 'Chaves Pix',
  summary: 'Consultar chave Pix por ID',
  operationType: 'atendimento',
  params: recordIdParamsSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'patch',
  path: '/customer-service/pix-keys/{id}',
  tag: 'Chaves Pix',
  summary: 'Mover chave Pix para outra conta do cliente',
  operationType: 'atendimento',
  params: recordIdParamsSchema,
  body: updatePixKeySchema,
  sessionHeader: true,
});
registerRoute({
  method: 'delete',
  path: '/customer-service/pix-keys/{id}',
  tag: 'Chaves Pix',
  summary: 'Excluir chave Pix',
  operationType: 'atendimento',
  params: recordIdParamsSchema,
  sessionHeader: true,
  successCode: 204,
  noContent: true,
});
registerRoute({
  method: 'post',
  path: '/customer-service/beneficiaries',
  tag: 'Favorecidos',
  summary: 'Cadastrar favorecido',
  operationType: 'atendimento',
  body: createBeneficiarySchema,
  sessionHeader: true,
  successCode: 201,
});
registerRoute({
  method: 'get',
  path: '/customer-service/beneficiaries',
  tag: 'Favorecidos',
  summary: 'Listar favorecidos',
  operationType: 'atendimento',
  query: listBeneficiariesSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'get',
  path: '/customer-service/beneficiaries/{id}',
  tag: 'Favorecidos',
  summary: 'Consultar favorecido por ID',
  operationType: 'atendimento',
  params: recordIdParamsSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'patch',
  path: '/customer-service/beneficiaries/{id}',
  tag: 'Favorecidos',
  summary: 'Atualizar favorecido',
  operationType: 'atendimento',
  params: recordIdParamsSchema,
  body: updateBeneficiarySchema,
  sessionHeader: true,
});
registerRoute({
  method: 'delete',
  path: '/customer-service/beneficiaries/{id}',
  tag: 'Favorecidos',
  summary: 'Excluir favorecido',
  operationType: 'atendimento',
  params: recordIdParamsSchema,
  sessionHeader: true,
  successCode: 204,
  noContent: true,
});

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Sistema'],
  summary: 'Verificar disponibilidade da API',
  responses: { 200: successResponse, 503: { description: 'Banco de dados indisponível' } },
});
registry.registerPath({
  method: 'get',
  path: '/openapi.json',
  tags: ['Sistema'],
  summary: 'Obter especificação OpenAPI',
  responses: { 200: { description: 'Documento OpenAPI em JSON' } },
});
registry.registerPath({
  method: 'get',
  path: '/docs',
  tags: ['Sistema'],
  summary: 'Abrir interface Swagger UI',
  responses: { 200: { description: 'Interface interativa da documentação' } },
});

// Gerar especificação OpenAPI 3.1 com schemas Zod registrados nas rotas
export const openApiDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'API Bancária Simulada',
    version: '1.0.0',
    description:
      'Sistema acadêmico de atendimento bancário. PIX e TED são simulações internas, sem integração financeira real.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Desenvolvimento local' }],
});

const transferOperation =
  openApiDocument.paths?.['/api/v1/customer-service/transactions/transfers']?.post;
if (transferOperation?.requestBody && 'content' in transferOperation.requestBody) {
  const transferContent = transferOperation.requestBody.content['application/json'];
  if (transferContent)
    transferOperation.requestBody.content['application/json'] = {
      ...transferContent,
      examples: {
        pix: {
          summary: 'Transferência Pix simulada',
          value: {
            transferType: 'PIX',
            sourceAccountId: '11111111-1111-4111-8111-111111111111',
            amountCents: '3000',
            pixKey: 'cliente@example.test',
          },
        },
        ted: {
          summary: 'Transferência TED simulada',
          value: {
            transferType: 'TED',
            sourceAccountId: '11111111-1111-4111-8111-111111111111',
            amountCents: '2000',
            destinationAgency: '0001',
            destinationAccountNumber: '7654321',
          },
        },
        internal: {
          summary: 'Transferência entre contas do titular',
          value: {
            transferType: 'INTERNAL',
            sourceAccountId: '11111111-1111-4111-8111-111111111111',
            destinationAccountId: '22222222-2222-4222-8222-222222222222',
            amountCents: '1000',
          },
        },
      },
    };
}
