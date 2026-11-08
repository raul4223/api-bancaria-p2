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
  accountNumberParamsSchema,
  customerCpfParamsSchema,
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

const operationTypeLabels = {
  público: 'pública, sem autenticação',
  geral: 'geral, exige apenas o JWT do administrador (bearerAuth)',
  atendimento:
    'em nome do cliente, exige o JWT (bearerAuth) e um atendimento aberto (serviceSession); o cliente é sempre o do atendimento',
};

// Registrar operação OpenAPI com schema de entrada e camada de autorização
function registerRoute(definition: {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  tag: string;
  summary: string;
  description: string;
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
    description: `${definition.description}\n\n**Tipo de operação:** ${operationTypeLabels[definition.operationType]}.`,
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
  description:
    'Recebe e-mail e senha do administrador master e devolve o `accessToken` (JWT, válido por 60 minutos). Cole o token em **Authorize → bearerAuth**.',
  operationType: 'público',
  body: loginSchema,
});
registerRoute({
  method: 'post',
  path: '/customers',
  tag: 'Clientes',
  summary: 'Cadastrar cliente e abrir a primeira conta',
  description:
    'Cadastra o cliente (nome, CPF, contato e senha de atendimento de 6 dígitos escolhida por ele) e **abre automaticamente a primeira conta**, na mesma transação. A conta é corrente por padrão; envie `accountType: "SAVINGS"` para poupança. A resposta traz a agência `0001` e o número da conta gerado pelo banco.',
  operationType: 'geral',
  body: createCustomerSchema,
  successCode: 201,
});
registerRoute({
  method: 'get',
  path: '/customers',
  tag: 'Clientes',
  summary: 'Listar clientes com CPF mascarado',
  description:
    'Lista **todos os clientes do banco**, paginado. O CPF aparece mascarado; cada cliente mostra suas contas (agência, número, tipo e status), a quantidade de contas e o saldo total. Filtros: `search` (nome ou e-mail) e `cpf` (busca exata).',
  operationType: 'geral',
  query: listCustomersSchema,
});
registerRoute({
  method: 'get',
  path: '/customers/{cpf}',
  tag: 'Clientes',
  summary: 'Consultar cliente pelo CPF',
  description:
    'Busca um cliente pelo **CPF** (o documento que ele apresenta na agência) e devolve os dados completos e todas as contas com saldo. Use para conferir o cadastro antes de abrir o atendimento.',
  operationType: 'geral',
  params: customerCpfParamsSchema,
});
registerRoute({
  method: 'patch',
  path: '/customers/{cpf}',
  tag: 'Clientes',
  summary: 'Atualizar dados de contato',
  description:
    'Atualiza nome, e-mail e telefone do cliente identificado pelo CPF. CPF e senha de atendimento não podem ser alterados.',
  operationType: 'geral',
  params: customerCpfParamsSchema,
  body: updateCustomerSchema,
});
registerRoute({
  method: 'delete',
  path: '/customers/{cpf}',
  tag: 'Clientes',
  summary: 'Excluir cadastro sem histórico',
  description:
    'Exclui fisicamente um cadastro feito por engano, junto com a conta aberta no cadastro. Só é permitido quando o cliente **não teve atendimentos, a conta nunca foi movimentada e o saldo é zero**; caso contrário devolve 409 `CUSTOMER_HAS_HISTORY`, preservando o histórico financeiro.',
  operationType: 'geral',
  params: customerCpfParamsSchema,
  successCode: 204,
  noContent: true,
});
registerRoute({
  method: 'post',
  path: '/service-sessions',
  tag: 'Atendimento',
  summary: 'Abrir atendimento com senha do cliente',
  description:
    'Abre o atendimento na bancada: o cliente informa CPF e a própria senha de atendimento. Devolve o `id` do atendimento, que deve ser colado em **Authorize → serviceSession**. Senha errada 5 vezes seguidas bloqueia a senha por 15 minutos (423).',
  operationType: 'geral',
  body: openServiceSessionSchema,
  successCode: 201,
});
registerRoute({
  method: 'patch',
  path: '/service-sessions/{serviceSessionId}/close',
  tag: 'Atendimento',
  summary: 'Fechar atendimento',
  description:
    'Encerra o atendimento. Depois disso, nenhuma operação em nome do cliente é aceita com esse ID (403).',
  operationType: 'geral',
  params: sessionIdParamsSchema,
});
registerRoute({
  method: 'post',
  path: '/customer-service/accounts',
  tag: 'Contas do cliente (atendimento)',
  summary: 'Abrir conta adicional para o cliente atendido',
  description:
    '**Abre uma conta adicional** (corrente `CHECKING` ou poupança `SAVINGS`) para o cliente do atendimento, com saldo zero; por exemplo, a poupança de quem já tem corrente. A primeira conta já é aberta no cadastro do cliente. O banco gera o número (7 dígitos) na agência 0001.',
  operationType: 'atendimento',
  body: openAccountSchema,
  sessionHeader: true,
  successCode: 201,
});
registerRoute({
  method: 'get',
  path: '/customer-service/accounts',
  tag: 'Contas do cliente (atendimento)',
  summary: 'Listar todas as contas do cliente atendido',
  description:
    '**Lista todas as contas** do cliente do atendimento, com número, tipo, status e saldo. Use para descobrir o número de cada conta.',
  operationType: 'atendimento',
  query: listAccountsSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'get',
  path: '/customer-service/accounts/{accountNumber}',
  tag: 'Contas do cliente (atendimento)',
  summary: 'Consultar uma conta do cliente atendido pelo número',
  description:
    '**Consulta uma única conta** pelo número, com saldo e status. Só encontra contas do cliente do atendimento; conta de outro cliente devolve 404.',
  operationType: 'atendimento',
  params: accountNumberParamsSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'patch',
  path: '/accounts/{accountNumber}/status',
  tag: 'Gestão de contas (geral)',
  summary: 'Bloquear ou desbloquear conta pelo número',
  description:
    '**Gestão do banco (não depende de atendimento):** bloqueia a conta (`{ "status": "BLOCKED", "reason": "..." }`) ou desbloqueia (`{ "status": "ACTIVE" }`). Conta bloqueada não envia nem recebe dinheiro. Usado, por exemplo, em suspeita de fraude.',
  operationType: 'geral',
  params: accountNumberParamsSchema,
  body: updateAccountStatusSchema,
});
registerRoute({
  method: 'get',
  path: '/ledger/reconciliation',
  tag: 'Ledger',
  summary: 'Conciliar saldos e lançamentos',
  description:
    'Confere a contabilidade do banco: total de débitos = total de créditos, saldo de cada conta = soma dos seus lançamentos e soma de todos os saldos = 0. Devolve `balanced: true` quando tudo confere.',
  operationType: 'geral',
});
registerRoute({
  method: 'post',
  path: '/customer-service/transactions/deposits',
  tag: 'Movimentações',
  summary: 'Depositar em conta do cliente',
  description:
    'Deposita dinheiro em espécie entregue pelo cliente na bancada, numa conta dele (pelo número). Exige `Idempotency-Key` (UUID) para não duplicar se a requisição for repetida.',
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
  description:
    'Saca dinheiro em espécie de uma conta do cliente (pelo número). Recusa saldo insuficiente. Exige `Idempotency-Key`.',
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
  description:
    '**Endpoint complexo.** Transfere a partir de uma conta do cliente (`sourceAccountNumber`):\n- `PIX`: destino pela chave Pix; grátis; limite noturno de R$ 1.000 entre 20h e 6h.\n- `TED`: destino por agência + número da conta; tarifa de R$ 5; só em dias úteis, das 06:30 às 17:00.\n- `INTERNAL`: entre duas contas do mesmo cliente (`destinationAccountNumber`); grátis.\n\nTudo acontece numa única transação, com ledger de partidas dobradas e `Idempotency-Key`.',
  operationType: 'atendimento',
  body: transferSchema,
  sessionHeader: true,
  idempotencyHeader: true,
  successCode: 201,
});
registerRoute({
  method: 'get',
  path: '/customer-service/accounts/{accountNumber}/statement',
  tag: 'Movimentações',
  summary: 'Consultar extrato paginado da conta',
  description:
    'Extrato paginado de uma conta do cliente (pelo número), do mais recente para o mais antigo, com filtros de período, tipo e tipo de transferência. Mostra a contraparte mascarada e o operador que executou cada operação.',
  operationType: 'atendimento',
  params: accountNumberParamsSchema,
  query: statementQuerySchema,
  sessionHeader: true,
});
registerRoute({
  method: 'post',
  path: '/customer-service/pix-keys',
  tag: 'Chaves Pix',
  summary: 'Cadastrar chave Pix',
  description:
    'Cadastra uma chave Pix (CPF, e-mail, telefone ou aleatória) ligada a uma conta do cliente, informada pelo número. Máximo de 5 chaves por conta.',
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
  description: 'Lista as chaves Pix do cliente do atendimento.',
  operationType: 'atendimento',
  query: listPixKeysSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'get',
  path: '/customer-service/pix-keys/{id}',
  tag: 'Chaves Pix',
  summary: 'Consultar chave Pix por ID',
  description: 'Consulta uma chave Pix do cliente do atendimento pelo ID da chave.',
  operationType: 'atendimento',
  params: recordIdParamsSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'patch',
  path: '/customer-service/pix-keys/{id}',
  tag: 'Chaves Pix',
  summary: 'Mover chave Pix para outra conta do cliente',
  description:
    'Move a chave Pix para outra conta do mesmo cliente (`accountNumber`). Tipo e valor da chave não mudam.',
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
  description: 'Exclui a chave Pix. Transferências antigas continuam registrando a chave usada.',
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
  description:
    'Salva um favorecido na agenda do cliente: PIX (chave) ou TED (agência + número da conta de destino). Salvar não autoriza transferência; a transferência valida tudo de novo.',
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
  description: 'Lista os favorecidos do cliente do atendimento.',
  operationType: 'atendimento',
  query: listBeneficiariesSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'get',
  path: '/customer-service/beneficiaries/{id}',
  tag: 'Favorecidos',
  summary: 'Consultar favorecido por ID',
  description: 'Consulta um favorecido do cliente do atendimento pelo ID.',
  operationType: 'atendimento',
  params: recordIdParamsSchema,
  sessionHeader: true,
});
registerRoute({
  method: 'patch',
  path: '/customer-service/beneficiaries/{id}',
  tag: 'Favorecidos',
  summary: 'Atualizar favorecido',
  description: 'Atualiza apelido e dados de destino do favorecido, validando o destino de novo.',
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
  description: 'Exclui o favorecido. Não altera transferências já feitas.',
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
            sourceAccountNumber: '1234567',
            amountCents: '3000',
            pixKey: 'cliente@example.test',
          },
        },
        ted: {
          summary: 'Transferência TED simulada',
          value: {
            transferType: 'TED',
            sourceAccountNumber: '1234567',
            amountCents: '2000',
            destinationAgency: '0001',
            destinationAccountNumber: '7654321',
          },
        },
        internal: {
          summary: 'Transferência entre contas do titular',
          value: {
            transferType: 'INTERNAL',
            sourceAccountNumber: '1234567',
            destinationAccountNumber: '2345678',
            amountCents: '1000',
          },
        },
      },
    };
}
