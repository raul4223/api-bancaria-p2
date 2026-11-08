# Prompt para o Codex — Trabalho P2: API Bancária Simulada para Atendimento em Agência (Arquitetura em Camadas) — v6

> Copie todo este conteúdo como instrução para o Codex dentro de um repositório novo. Idioma da documentação, mensagens ao usuário e **comentários de código**: português do Brasil. Nomes de classes, arquivos e identificadores de código: inglês, consistentes.

> **Versão 6 — simplificação da arquitetura em relação à v5.**
> - **Sai DDD + Clean Architecture; entra a arquitetura em camadas apresentada em aula:** `Route → Middleware → Controller → Service → Repository → Prisma/MySQL`. O PDF permite usá-la sem justificativa extra.
> - Saem: entidades de domínio, value objects, mappers, interfaces de repositório, ports, Unit of Work e container de injeção complexo.
> - As **regras de negócio ficam nos Services**. As regras de cada tipo de transferência ficam em 3 classes pequenas (**padrão Strategy**).
> - Um **controller, um service e um repository por módulo**, com métodos por operação. Isso reduz o projeto de ~150 para ~55 arquivos.
> - **Sem mudança:** conceito (admin master + atendimento autorizado pela senha do cliente), **27 rotas funcionais**, **3 CRUDs** (Clientes, Chaves Pix, Favorecidos), endpoint complexo de transferência PIX/TED/INTERNAL, ledger, idempotência, concorrência, auditoria, Swagger, apresentação, demo, camelCase e **comentário curto acima de cada função**.
>
> **Total planejado: 30 rotas** (27 funcionais + 3 auxiliares).

## Objetivo

Implemente neste repositório uma API REST completa de **sistema de atendimento de um banco digital simulado**, exclusivamente acadêmica, usando Node.js, TypeScript, **Express 5**, **MySQL 8.4 (InnoDB)**, Prisma ORM 7 com Prisma Migrate, Zod 4, Argon2id, JWT, Swagger/OpenAPI, Vitest e Supertest. O sistema deve ser executável, documentado e testado, sem conectar-se a instituições financeiras ou movimentar dinheiro real. "Pix" e "TED" são **simulações de regras de negócio dentro do mesmo banco fictício**, sem integração com Banco Central, SPI, STR ou outros bancos.

**Contexto do problema (usar no README e nos slides):** muitos clientes, principalmente idosos ou pessoas com pouca familiaridade com tecnologia, não conseguem usar o aplicativo ou o caixa eletrônico sozinhos. Na agência, um funcionário os atende numa bancada. O sistema precisa permitir que esse funcionário opere **em nome do cliente** com segurança: só depois de o cliente confirmar a própria senha, com tudo registrado para auditoria e sem risco de saldo inconsistente. O mesmo sistema também serve para a gestão geral: cadastro de clientes, bloqueio de contas e conferência do ledger.

**DECISÕES DO GRUPO:**
- **Usuário do sistema:** apenas o **administrador master** (operador do banco), autenticado com JWT. Não há cadastro público de usuários; o admin é criado pelo seed.
- **3 CRUDs completos** (mínimo exigido pelo professor): **Clientes, Chaves Pix e Favorecidos**. Cada um tem CREATE, READ listagem, READ por ID, UPDATE e DELETE físico, com rotas reais, Swagger, migrations e testes E2E. **Como o grupo está exatamente no mínimo, os três CRUDs precisam estar 100% completos e testados; nenhum pode ficar parcial.**
- **Endpoint complexo obrigatório:** `POST /api/v1/customer-service/transactions/transfers`, com três tipos de transferência (`PIX`, `TED`, `INTERNAL`), executado dentro de um atendimento autorizado pelo cliente.
- **Arquitetura em camadas da aula** (Controller → Service → Repository), simples e fácil de explicar.

**IMPORTANTE — Prisma + MySQL:** fixe `prisma` e `@prisma/client` na **mesma versão 7.x** e inclua `package-lock.json`. Não instale indiscriminadamente a major mais nova. Use o provider `mysql` em `prisma/schema.prisma`, o adaptador oficial `@prisma/adapter-mariadb` (`PrismaMariaDb`) para conectar o Prisma 7 ao **servidor MySQL 8.4**, `prisma.config.ts` para migrations e seed, gerador `prisma-client` com output explícito e instância única de `PrismaClient({ adapter })`. O nome do adaptador contém "mariadb", mas ele suporta MySQL. Configure as variáveis host/user/password/database/port usadas pelo adapter e a `DATABASE_URL` usada pela Prisma CLI. Crie, versione e aplique migrations com `prisma migrate dev`; não substitua por `db push`. Depois das migrations, execute `prisma generate` explicitamente. Verifique a documentação oficial da versão fixada antes de instalar.

## Fonte de requisitos e prioridade (enunciado do professor: Trabalho Desenvolvimento de uma API — P2)

Trabalho de **Desenvolvimento Back-End**, professor **Vinícius Hungaro**. O **grupo tem quatro integrantes** e a apresentação dura **40 a 50 minutos**. Tema permitido por não ser sistema de biblioteca: **sistema de atendimento de banco digital simulado**. O enunciado é a fonte prioritária da avaliação; as decisões do grupo **nunca podem substituir um requisito do PDF**.

**Matriz de conformidade — cumprir, testar e documentar em `docs/REQUIREMENTS_P2.md` (cada linha com local no código, endpoint, teste e evidência de demo):**

| # | Exigência do professor (PDF) | Implementação e evidência esperada |
|---|---|---|
| 1 | Grupo de 4 integrantes | Roteiro de apresentação dividido em 4 blocos (`docs/PRESENTATION_40_50_MIN.md`) |
| 2 | Apresentação de 40 a 50 minutos | Roteiro de 45 min com contingência |
| 3 | API back-end de tema livre, **exceto biblioteca** | Sistema de atendimento de banco **simulado** |
| 4 | Contextualizar: **tema**, **objetivo da API** e **qual necessidade/regra de negócio atende** | Seção "Contexto" no README e nos slides: atendimento presencial a clientes com dificuldade de usar app/caixa; objetivo; regra principal (transferências PIX/TED/interna autorizadas pelo cliente, atômicas e auditáveis) |
| 5 | Preferência: **MySQL, TypeScript, Prisma, Swagger** | Usar **os quatro** |
| 6 | Outras tecnologias só com **justificativa técnica coerente** | Seção "Justificativa das tecnologias" em `docs/ARCHITECTURE.md` explicando Express 5, Zod, Argon2id, jose/JWT, Vitest/Supertest, Helmet, express-rate-limit e Docker; e um slide correspondente |
| 7 | **Mínimo de 13 endpoints** | **27 rotas funcionais** (+ 3 auxiliares = 30); contagem automática a partir do OpenAPI; a matriz reflete o total **real** implementado |
| 8 | **Mínimo de 3 CRUDs completos** (Create, Read geral, Read por ID, Update, Delete) | **3 CRUDs** (Customers, PixKeys, Beneficiaries) = **15 operações**, cada um com teste E2E Create → List → Get → Update → Get → Delete → Get(404) |
| 9 | **1 endpoint complexo** ligado à regra de negócio principal (**não** vale login/autenticação/cadastro de usuário) | `POST /api/v1/customer-service/transactions/transfers`: atendimento válido, tipos PIX/TED/INTERNAL, tarifa, horário, limite noturno, saldo, propriedade, atomicidade, partidas dobradas, idempotência, concorrência e auditoria |
| 10 | Segurança: **validação de entrada** | Zod em todo body, params, query e header |
| 11 | Segurança: **tratamento de erros** | `errorMiddleware` + classe `AppError`, formato padronizado `{ error: { code, message } }`, sem stack trace |
| 12 | Segurança: **controle de acesso/autenticação** | Dois níveis: (1) JWT do admin em todas as rotas protegidas; (2) **atendimento autorizado pela senha do cliente** para qualquer operação em nome dele, com bloqueio após tentativas erradas |
| 13 | Segurança: **proteção adequada das informações** | Argon2id para as senhas do admin e dos clientes; hashes nunca expostos; segredos fora do repositório; **CPF mascarado** na listagem de clientes; auditoria de operador e atendimento em cada transação; Helmet, CORS, rate limit e limite de body |
| 14 | Arquitetura em camadas da aula **ou** outra arquitetura justificada | **Arquitetura em camadas da aula**: Route → Middleware → Controller → Service → Repository → Prisma. `docs/ARCHITECTURE.md` explica a responsabilidade de cada camada com um diagrama |
| 15 | **Padronização de nomenclatura** | camelCase/PascalCase com ESLint `naming-convention` (decisão do grupo) |
| 16 | **Separação adequada de responsabilidades** | Controller só lida com HTTP; Service concentra as regras de negócio; Repository só acessa o banco; Middlewares tratam autenticação, atendimento, validação e erros |
| 17 | **Clareza e legibilidade** | Funções curtas, nomes explícitos e **comentário curto acima de cada função** |
| 18 | Slides com: tema, contextualização, arquitetura, **padrões de projeto/organização**, regra de negócio principal, tecnologias | `docs/PRESENTATION_40_50_MIN.md` com checklist slide a slide; padrões citados: **Arquitetura em camadas, Repository, Service Layer, Strategy (regras de transferência), Middleware (chain of responsibility) e validação por Schema**. **O arquivo final de slides é preparado pelo grupo** |
| 19 | Demo: **endpoints**, **documentação**, **banco de dados**, **código-fonte** | `docs/DEMO_CHECKLIST.md` com passos reproduzíveis para Swagger, MySQL/Prisma Studio e arquivos por camada |
| 20 | Código em **repositório público no GitHub** + envio do link | Checklist de publicação; **não publicar sem autorização** |
| 21 | Repositório com **todo o código necessário para execução** | Clone limpo testado; nada depende de arquivo local não documentado |
| 22 | **README** com instalação e execução | README em pt-BR completo |
| 23 | Slides enviados pelo **Google Classroom** no prazo do professor | Lembrete no README/checklist; **prazo não informado no PDF, não inventar data** |
| 24 | Critérios: requisitos, qualidade, organização, tecnologias, documentação, clareza, demo prática | Coberto pelas linhas acima; `REQUIREMENTS_P2.md` termina com um checklist final de entrega |

**Não confundir regra do professor com preferência do grupo:** o mínimo acadêmico é 3 CRUDs e 13 endpoints. CRUD completo tem **duas consultas GET distintas** (lista e por ID), logo 5 operações por recurso. Login e abertura de atendimento **não** valem como endpoint complexo; **transferência** vale. Contas, transações e atendimentos **não** são contados como CRUD.

## Stack e convenções

- Node.js 24 LTS (compatível com Prisma 7), npm e TypeScript em modo `strict`.
- ESM (`"type": "module"`), `tsx` em desenvolvimento; TypeScript compilado para produção com imports ESM funcionando.
- **Express 5** (trata erros de handlers `async` nativamente, sem wrapper); Zod 4 para validação de entrada na borda HTTP. Os tipos de entrada dos services são inferidos dos schemas (`z.infer<typeof createCustomerSchema>`), sem arquivos de DTO separados.
- Prisma 7 + MySQL 8.4 em Docker Compose, engine InnoDB e `prisma.config.ts`. Banco MySQL de **teste separado**.
- `argon2` com **Argon2id** e parâmetros configuráveis, mínimos iniciais `memoryCost:19456`, `timeCost:2`, `parallelism:1`, tanto para a senha do admin quanto para a senha de atendimento do cliente. Hash e verificação centralizados em `utils/password.ts`; nunca armazenar senha em texto puro.
- `jose` para **access token** JWT do admin, com **validade de 60 minutos** (`ACCESS_TOKEN_TTL=60m`), verificando assinatura, algoritmo, issuer, audience e expiração. O payload contém `sub` (id do admin). Segredo forte via `.env` não versionado. Geração e verificação centralizadas em `utils/token.ts`.
- **Sem refresh token e sem logout no servidor** (decisão de escopo). Quando o token expira, o admin faz login de novo. Documentar em `BUSINESS_RULES.md` como melhoria futura.
- `@asteasolutions/zod-to-openapi` (versão compatível com Zod 4) + `swagger-ui-express`: OpenAPI gerado a partir dos schemas Zod. UI em `/docs`, JSON em `/openapi.json`. **Dois esquemas de segurança** no botão Authorize: `bearerAuth` (JWT do admin) e `serviceSession` (apiKey no header `X-Service-Session-Id`). Assim o grupo informa os dois uma vez só durante a demo.
- Vitest e Supertest; ESLint + Prettier; logs sem dados sensíveis; variáveis de ambiente validadas com Zod no bootstrap.
- `helmet`, `cors` e `express-rate-limit`. **O rate limit fica desligado quando `NODE_ENV=test`**.
- Funções e arquivos curtos, nomes explícitos, nenhuma abstração sem uso concreto. Sem `any`, sem código morto, sem funções vazias, sem placeholders para funcionalidades declaradas como prontas.

## Arquitetura em camadas (a mesma vista em aula)

```text
Requisição HTTP
   │
   ▼
Route ──────────► define método + caminho e encadeia middlewares
   │
   ▼
Middlewares ────► autenticação (JWT), atendimento, validação (Zod), rate limit
   │
   ▼
Controller ─────► lê req (body, params, query), chama o service, devolve res com status HTTP
   │
   ▼
Service ────────► REGRAS DE NEGÓCIO: validações de negócio, cálculos, transações
   │
   ▼
Repository ─────► consultas e gravações no banco via Prisma (sem regra de negócio)
   │
   ▼
Prisma Client ──► MySQL 8.4
```

**Regras de cada camada (registrar em `docs/ARCHITECTURE.md` e `AGENTS.md`):**
- **Route:** só liga caminho → middlewares → método do controller. Sem lógica.
- **Controller:** só lida com HTTP. Não acessa Prisma nem contém regra de negócio. Converte a resposta com funções de formatação (`utils/presenters.ts`), por exemplo `bigint` → string e CPF mascarado.
- **Service:** concentra **todas** as regras de negócio. Pode chamar vários repositories e abrir `prisma.$transaction`. Lança erros com `AppError`. Não conhece `req`/`res`.
- **Repository:** só acessa o banco com Prisma. Sem regra de negócio. Métodos que participam de transação recebem o cliente da transação (`tx`) como último parâmetro opcional.
- **Middlewares:** autenticação, atendimento, validação, rate limit e tratamento de erros.
- **Utils:** funções puras e reutilizáveis (dinheiro em centavos, CPF, senha do cliente, chave Pix, horário do banco, mascaramento, hash, JWT, fingerprint de idempotência).
- **Montagem:** `src/container.ts` cria as instâncias com `new` (repositories → services → controllers), passando as dependências pelo construtor. Isso facilita os testes e não exige biblioteca de injeção.

## Regra obrigatória de comentários: um comentário curto acima de cada função

**DECISÃO DO GRUPO** (para facilitar a leitura do código por todos os integrantes e na demonstração ao professor):

- **Toda função, método e arrow function nomeada** (routes, controllers, services, regras de transferência, repositories, middlewares, utils, seed e helpers de teste) deve ter **um comentário de uma linha imediatamente acima**, em **português do Brasil**, no **infinitivo**, descrevendo o que ela faz.
- **Toda classe** também recebe um comentário de uma linha acima da declaração, dizendo sua responsabilidade.
- Formato: `// Verbo + complemento`, curto (até ~80 caracteres), sem ponto final, sem JSDoc obrigatório e sem repetir a assinatura.
- Os casos de teste (`it(...)`/`test(...)`) já se descrevem pelo título e não precisam de comentário extra; funções auxiliares de teste precisam.
- Além do comentário obrigatório, comentários extras **só** para explicar decisões não óbvias (ex.: por que o UPDATE é condicional).
- Código autogerado (`src/generated/**`, `prisma/migrations/**`) fica isento.
- Registrar esta regra em `AGENTS.md` e `docs/ARCHITECTURE.md`. **Nenhum arquivo é considerado pronto sem os comentários.**

Exemplo do fluxo completo de uma operação, com os comentários:

```ts
// routes/customer.routes.ts
// Registrar rotas do CRUD de clientes
customerRoutes.get('/:customerId', authMiddleware, validate({ params: customerIdParamsSchema }), customerController.getById);

// controllers/CustomerController.ts
// Controller que recebe as requisições HTTP de clientes
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // Buscar cliente pelo ID e devolver os dados formatados
  getById = async (req: Request, res: Response) => {
    const customer = await this.customerService.getById(req.params.customerId);
    res.status(200).json(presentCustomerDetails(customer));
  };
}

// services/CustomerService.ts
// Service com as regras de negócio de clientes
export class CustomerService {
  constructor(private readonly customerRepository: CustomerRepository) {}

  // Buscar cliente pelo ID ou lançar erro se não existir
  async getById(customerId: string) {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw appErrors.customerNotFound();
    return customer;
  }
}

// repositories/CustomerRepository.ts
// Repository que acessa a tabela de clientes
export class CustomerRepository {
  // Buscar cliente pelo ID com as contas
  findById(id: string) {
    return prisma.customer.findUnique({ where: { id }, include: { accounts: true } });
  }
}
```

## Padrão obrigatório de nomenclatura: camelCase

**DECISÃO DO GRUPO** (o professor exige "padronização de nomenclatura"; o grupo escolheu camelCase para cumprir esse requisito): todo o código TypeScript segue **camelCase** em nomes de **funções, métodos, variáveis, parâmetros, propriedades e instâncias de controllers, services e repositories**. **Não usar `snake_case`** nesses identificadores.

- **camelCase:** `createCustomer()`, `getById()`, `balanceCents`, `customerId`, `customerService`, `customerRepository`, `authMiddleware`.
- **PascalCase** (classes, tipos, interfaces, enums e modelos Prisma): `CustomerController`, `CustomerService`, `CustomerRepository`, `TransferRule`, `AppError`. A classe é PascalCase e a instância é camelCase: `const customerService = new CustomerService(customerRepository)`.
- **Membros de enum** em `UPPER_CASE` (`ACTIVE`, `PIX`, `OPEN`), como no Prisma.
- **Arquivos:** classes em PascalCase (`CustomerService.ts`); funções e instâncias em camelCase (`authMiddleware.ts`, `prisma.ts`, `money.ts`); rotas e schemas com sufixo por tipo e `kebab-case` (`customer.routes.ts`, `pix-key.schemas.ts`).
- **Rotas REST** com mais de uma palavra em `kebab-case`: `/api/v1/pix-keys`, `/api/v1/service-sessions`, `/api/v1/customer-service`.
- **Campos Prisma** em camelCase (`customerId`, `createdAt`, `balanceCents`) e **modelos em PascalCase**.
- **Variáveis de ambiente** em `UPPER_SNAKE_CASE` (`DATABASE_URL`, `JWT_SECRET`), convertidas para um objeto `env` com propriedades camelCase em `config/env.ts`.
- **Mesmos nomes de método nas três camadas, por operação:**

| Operação | Controller | Service | Repository |
|---|---|---|---|
| Criar | `create` | `create` | `create` |
| Listar | `list` | `list` | `findMany` |
| Buscar por ID | `getById` | `getById` | `findById` |
| Atualizar | `update` | `update` | `update` |
| Excluir | `delete` | `delete` | `delete` |

  Operações específicas usam verbos explícitos e iguais nas camadas: `open`/`close` (atendimento), `changeStatus` (conta), `deposit`/`withdraw`/`transfer`/`getStatement` (transações), `getReconciliation` (ledger).
- **ESLint `@typescript-eslint/naming-convention`:** camelCase para funções, métodos, variáveis e propriedades; PascalCase para classes, interfaces, tipos e enums; **UPPER_CASE permitido para membros de enum e constantes de módulo**. `npm run lint` deve falhar diante de `snake_case` indevido. **Exceções técnicas:** ignorar `src/generated/**` e `prisma/migrations/**`; permitir propriedades entre aspas com nomes externos (`'X-Service-Session-Id'`, `'Idempotency-Key'`, `'Content-Type'`) e chaves exigidas por bibliotecas ou pela especificação OpenAPI.
- Registrar a convenção em `AGENTS.md`, `README.md` e `docs/ARCHITECTURE.md`. **A convenção tem precedência sobre nomes escolhidos automaticamente pelo Codex.**

## Estrutura de pastas

```text
bank-api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                        # conta SYSTEM + admin master (via .env)
├── src/
│   ├── config/
│   │   └── env.ts                     # lê e valida o .env com Zod
│   ├── database/
│   │   └── prisma.ts                  # instância única do PrismaClient com o adapter
│   ├── routes/
│   │   ├── index.ts                   # monta todas as rotas em /api/v1
│   │   ├── auth.routes.ts
│   │   ├── customer.routes.ts
│   │   ├── service-session.routes.ts
│   │   ├── account.routes.ts          # geral: /accounts/:id/status
│   │   ├── ledger.routes.ts           # geral: /ledger/reconciliation
│   │   └── customer-service.routes.ts # tudo sob /customer-service (exige atendimento)
│   ├── controllers/
│   │   ├── AuthController.ts
│   │   ├── CustomerController.ts
│   │   ├── ServiceSessionController.ts
│   │   ├── AccountController.ts
│   │   ├── TransactionController.ts   # depósito, saque, transferência, extrato
│   │   ├── LedgerController.ts
│   │   ├── PixKeyController.ts
│   │   └── BeneficiaryController.ts
│   ├── services/
│   │   ├── AuthService.ts
│   │   ├── CustomerService.ts
│   │   ├── ServiceSessionService.ts
│   │   ├── AccountService.ts
│   │   ├── TransactionService.ts      # depósito, saque e extrato
│   │   ├── TransferService.ts         # endpoint complexo
│   │   ├── LedgerService.ts
│   │   ├── PixKeyService.ts
│   │   ├── BeneficiaryService.ts
│   │   └── transfer-rules/            # padrão Strategy
│   │       ├── TransferRule.ts        # interface comum
│   │       ├── InternalTransferRule.ts
│   │       ├── PixTransferRule.ts
│   │       ├── TedTransferRule.ts
│   │       └── getTransferRule.ts     # escolhe a regra pelo transferType
│   ├── repositories/
│   │   ├── UserRepository.ts
│   │   ├── CustomerRepository.ts
│   │   ├── ServiceSessionRepository.ts
│   │   ├── AccountRepository.ts
│   │   ├── TransactionRepository.ts   # BankTransaction + LedgerEntry
│   │   ├── PixKeyRepository.ts
│   │   └── BeneficiaryRepository.ts
│   ├── schemas/                       # validação Zod + registro no OpenAPI
│   │   ├── common.schemas.ts          # paginação, UUID, amountCents
│   │   ├── auth.schemas.ts
│   │   ├── customer.schemas.ts
│   │   ├── service-session.schemas.ts
│   │   ├── account.schemas.ts
│   │   ├── transaction.schemas.ts
│   │   ├── pix-key.schemas.ts
│   │   └── beneficiary.schemas.ts
│   ├── middlewares/
│   │   ├── authMiddleware.ts
│   │   ├── serviceSessionMiddleware.ts
│   │   ├── validate.ts
│   │   ├── rateLimit.ts
│   │   └── errorMiddleware.ts
│   ├── errors/
│   │   ├── AppError.ts                # erro com statusCode + code + message
│   │   └── appErrors.ts               # catálogo: insufficientFunds(), customerNotFound()...
│   ├── utils/
│   │   ├── money.ts                   # string ↔ bigint em centavos, sem float
│   │   ├── cpf.ts                     # validação dos dígitos verificadores
│   │   ├── customerPassword.ts        # 6 dígitos, recusa senhas fracas
│   │   ├── pixKey.ts                  # validação de e-mail/telefone/CPF como chave
│   │   ├── bankTime.ts                # hora local do banco, dia útil, intervalos
│   │   ├── clock.ts                   # now() substituível nos testes
│   │   ├── mask.ts                    # mascarar CPF, número de conta e nome
│   │   ├── password.ts                # hash e verificação Argon2id
│   │   ├── token.ts                   # gerar e verificar JWT
│   │   ├── idempotency.ts             # fingerprint SHA-256 do payload
│   │   └── presenters.ts              # formatar respostas (bigint → string etc.)
│   ├── docs/
│   │   └── openapi.ts                 # monta o documento OpenAPI e o Swagger UI
│   ├── types/
│   │   └── express.d.ts               # req.auth e req.serviceSession tipados
│   ├── generated/prisma/              # autogerado, nunca editado manualmente
│   ├── container.ts                   # cria repositories → services → controllers
│   ├── app.ts                         # Express, middlewares globais, rotas, Swagger
│   └── server.ts                      # sobe o servidor
├── tests/
│   ├── unit/                          # utils e regras de transferência (sem banco)
│   ├── e2e/                           # rotas com Supertest no banco de teste
│   └── helpers/                       # criar admin, cliente, atendimento, conta
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API_FLOWS.md
│   ├── BUSINESS_RULES.md
│   ├── REQUIREMENTS_P2.md             # inclui a matriz de endpoints
│   ├── PRESENTATION_40_50_MIN.md
│   └── DEMO_CHECKLIST.md
├── .env.example
├── .gitignore
├── .prettierrc.json
├── eslint.config.js
├── docker-compose.yml
├── prisma.config.ts
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── package.json
├── AGENTS.md
└── README.md
```

Adapte a árvore **apenas** quando uma necessidade técnica real exigir; mantenha as camadas, a nomenclatura e um controller/service/repository por módulo.

## Modelo de acesso: admin master + atendimento autorizado pelo cliente

O sistema tem **dois tipos de operação**:

| Tipo | Exige | Exemplos |
|---|---|---|
| **Operação geral** | JWT do admin (`Authorization: Bearer ...`) | CRUD de clientes, abrir/fechar atendimento, bloquear/desbloquear conta, conferir o ledger |
| **Operação em nome do cliente** | JWT do admin **+** atendimento aberto (`X-Service-Session-Id`) | Abrir conta, consultar conta e extrato, depositar, sacar, transferir, CRUDs de Chaves Pix e Favorecidos |

**Admin (operador):**
- Criado **somente pelo seed**, com `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env` local (não versionado). Sem essas variáveis, o seed pula o admin e avisa.
- Faz login com e-mail e senha (`POST /auth/login`) e recebe o JWT.
- O modelo `User` representa operadores. O seed cria um admin master; não há rota para criar outros operadores (documentar como melhoria futura).

**Cliente:**
- Cadastrado pelo admin (`POST /customers`) com nome, CPF, e-mail e telefone opcionais e a **senha de atendimento** escolhida pelo cliente na hora (6 dígitos numéricos).
- `utils/customerPassword.ts` valida exatamente 6 dígitos e **recusa senhas fracas**: todos os dígitos iguais (`111111`) e sequências crescentes ou decrescentes (`123456`, `654321`) → 422 `WEAK_CUSTOMER_PASSWORD`. A senha é guardada só como hash Argon2id.
- O cliente não autentica na API. A senha serve **apenas** para abrir um atendimento.

**Atendimento (`ServiceSession`) — regras (implementadas em `ServiceSessionService`):**
1. **Abertura:** `POST /api/v1/service-sessions` com `{ cpf, customerPassword }` e o JWT do admin. Se o CPF não existe ou a senha está errada → **401 `INVALID_CUSTOMER_CREDENTIALS`** (mensagem genérica, sem revelar qual dos dois falhou).
2. **Bloqueio por tentativas:** cada senha errada incrementa `failedPasswordAttempts` do cliente. Na **5ª tentativa errada seguida**, a senha fica bloqueada por 15 minutos (`passwordLockedUntil`) → **423 `CUSTOMER_PASSWORD_LOCKED`**. Um acerto zera o contador; o bloqueio termina sozinho depois do prazo. Valores configuráveis (`CUSTOMER_MAX_PASSWORD_ATTEMPTS`, `CUSTOMER_PASSWORD_LOCK_MINUTES`).
3. **Um atendimento por vez:** abrir um novo atendimento fecha automaticamente o atendimento aberto anterior do mesmo operador.
4. **Validade:** o atendimento expira em `SERVICE_SESSION_TTL_MINUTES` (padrão **30 min**) a partir da abertura, ou antes, quando é fechado (`PATCH /service-sessions/:id/close`).
5. **Uso:** o `serviceSessionMiddleware` lê `X-Service-Session-Id` e chama `serviceSessionService.validate()`, que exige um atendimento que **exista**, esteja **`OPEN`**, **não expirado** e **pertença ao operador do JWT**. Senão → **401 `SERVICE_SESSION_REQUIRED`** (header ausente) ou **403 `SERVICE_SESSION_INVALID`**. O middleware coloca `customerId` e `serviceSessionId` em `req.serviceSession`.
6. **O `customerId` das operações em nome do cliente vem sempre do atendimento**, nunca do corpo, da query ou da URL. Assim o admin só opera as contas do cliente que confirmou a senha.
7. **Auditoria:** toda `BankTransaction` grava `operatorUserId` e `serviceSessionId`. O extrato mostra o nome do operador de cada transação, e os atendimentos ficam registrados na tabela `ServiceSession` (consultável no MySQL/Prisma Studio na demo).
8. **Senha esquecida:** fora do escopo desta versão (documentar como limitação e melhoria futura em `BUSINESS_RULES.md`).

## Tipos de transferência (regra de negócio principal)

Todas as contas pertencem ao mesmo banco simulado. Os três tipos se diferenciam pela **forma de identificar o destino**, pela **tarifa** e pelas **regras de horário/limite**:

| Tipo | Destino identificado por | Para quem | Tarifa | Horário | Limite |
|---|---|---|---|---|---|
| `INTERNAL` | `destinationAccountId` | **Somente outra conta do mesmo cliente** (ex.: corrente → poupança) | Grátis | 24h | — |
| `PIX` | `pixKey` (CPF, e-mail, telefone ou chave aleatória) | Qualquer cliente (inclusive ele mesmo) | Grátis | 24h, 7 dias | **Limite noturno por transação** entre `PIX_NIGHT_START` e `PIX_NIGHT_END` (padrão 20:00–06:00, R$ 1.000,00 = `PIX_NIGHT_LIMIT_CENTS=100000`) |
| `TED` | `destinationAgency` + `destinationAccountNumber` | Qualquer cliente | `TED_FEE_CENTS` (padrão R$ 5,00 = `500`) | Dias úteis (seg–sex), entre `TED_START_TIME` e `TED_END_TIME` (padrão 06:30–17:00), quando `TED_BUSINESS_HOURS_ENABLED=true` | — |

- Fuso horário do banco: `BANK_TIMEZONE=America/Sao_Paulo`. Feriados não são considerados (documentar como limitação).
- O limite noturno do Pix é **por transação** (simplificação do limite real, que é por período; documentar).
- **Tarifa de TED:** debita da origem `amount + fee`, credita `amount` no destino e `fee` na conta `SYSTEM`. São **3 lançamentos** no ledger, sempre equilibrados. `BankTransaction.feeCents` guarda a tarifa.
- **Padrão Strategy (simples):** interface `TransferRule` com dois métodos:

```ts
// Contrato comum das regras de cada tipo de transferência
export interface TransferRule {
  // Validar as regras específicas do tipo de transferência
  validate(context: TransferContext): void;
  // Calcular a tarifa cobrada por este tipo de transferência
  calculateFee(amountCents: bigint): bigint;
}
```

  Implementada por `InternalTransferRule` (destino precisa ser do mesmo cliente), `PixTransferRule` (limite noturno) e `TedTransferRule` (horário comercial e tarifa). `getTransferRule(transferType)` devolve a regra certa. As regras recebem a configuração (`env`) e o relógio (`clock`) e usam `utils/bankTime.ts`, então os testes controlam o horário sem depender da hora real.
- Erros específicos (em `appErrors.ts`): `PIX_KEY_NOT_FOUND` (404), `PIX_NIGHT_LIMIT_EXCEEDED` (422), `TED_OUTSIDE_BUSINESS_HOURS` (422), `INTERNAL_TRANSFER_REQUIRES_SAME_OWNER` (422), `SAME_ACCOUNT_TRANSFER` (422), `DESTINATION_ACCOUNT_NOT_FOUND` (404).

## Requisito escolar: TRÊS CRUDs completos

Três recursos com **POST, GET listagem, GET por ID, PATCH e DELETE**, persistidos no MySQL. Não basta ter só cadastro, só exclusão lógica ou rotas que retornem 501. **DELETE remove fisicamente a linha** e GET depois da exclusão retorna 404. Excluir nunca apaga contas, transações nem ledger.

| CRUD | Recurso | Rota base | Tipo de operação | Exclusão |
|---|---|---|---|---|
| 1 | Customer | `/api/v1/customers` | **Geral** (JWT) | física, **só se o cliente não tiver contas nem atendimentos** |
| 2 | PixKey | `/api/v1/customer-service/pix-keys` | **Em nome do cliente** (JWT + atendimento) | física |
| 3 | Beneficiary | `/api/v1/customer-service/beneficiaries` | Em nome do cliente | física |

Requisitos por módulo:
- **Customer** (gerenciado pelo admin): `id`, `name`, `cpf` (único, só dígitos, validado em `utils/cpf.ts`), `email?` (único), `phone?`, `passwordHash`, `failedPasswordAttempts`, `passwordLockedUntil?`, timestamps.
  - **POST** recebe `name`, `cpf`, `email?`, `phone?` e `customerPassword` (6 dígitos, validada por `utils/customerPassword.ts`). CPF ou e-mail duplicado → 409 `DUPLICATE_CUSTOMER`.
  - **GET lista:** **todos os clientes do banco**, paginada, com **CPF mascarado** (`***.456.789-**`), quantidade de contas e saldo total; filtros `search` (nome ou e-mail) e `cpf` (busca exata pelo CPF completo, que nunca é devolvido completo na lista).
  - **GET por ID:** dados completos (CPF completo, para o operador conferir com o documento do cliente) e as contas com número, tipo, saldo e status. Nunca devolve `passwordHash`.
  - **PATCH:** só `name`, `email` e `phone`. CPF e senha não mudam.
  - **DELETE:** só é permitido para cadastro feito por engano, ou seja, cliente **sem contas e sem atendimentos** → 204. Caso contrário → **409 `CUSTOMER_HAS_HISTORY`**. Documentar o motivo (preservar o histórico financeiro e a auditoria).
- **PixKey:** `id`, `customerId`, `accountId`, `keyType` (`CPF`, `EMAIL`, `PHONE`, `RANDOM`), `keyValue` (**único em todo o banco**), timestamps.
  - `CPF` só pode ser o CPF do próprio cliente do atendimento; `EMAIL` e `PHONE` são validados por `utils/pixKey.ts`; `RANDOM` é gerada pelo servidor com `crypto.randomUUID()` (o valor não é enviado).
  - A conta vinculada precisa ser do cliente do atendimento, `ACTIVE` e não `SYSTEM`.
  - **Máximo de 5 chaves por conta** (422 `PIX_KEY_LIMIT_REACHED`). Chave duplicada → 409 `PIX_KEY_ALREADY_EXISTS`.
  - **PATCH** altera apenas `accountId` (mover a chave para outra conta do mesmo cliente); tipo e valor são imutáveis.
  - DELETE remove a chave; transações antigas guardam a chave usada em `BankTransaction.pixKeyUsed`, então o histórico não muda.
- **Beneficiary:** favorecido salvo (a "agenda" do cliente): `id`, `customerId`, `nickname`, `transferType` (`PIX` ou `TED`), `pixKey?` (obrigatória se PIX), `destinationAgency?` e `destinationAccountNumber?` (obrigatórios se TED), timestamps.
  - Na criação e na atualização, valida que o destino existe, não é `SYSTEM` e não é conta do próprio cliente.
  - **PATCH** pode alterar `nickname` e os dados de destino (revalidando o destino).
  - Guardar um favorecido **não autoriza** transferência: a transferência valida tudo de novo. A exclusão não altera transferências já feitas.

Cada CRUD precisa de:
1. Modelo Prisma, índices, relação com `Customer` e migration; `onDelete: Restrict` em relações com `Account`.
2. `...Repository` com `create`, `findMany`, `findById`, `update` e `delete`.
3. `...Service` com `create`, `list`, `getById`, `update` e `delete`, contendo as regras acima.
4. `...Controller` com os mesmos 5 métodos, rotas, schemas Zod e documentação no Swagger.
5. CRUDs de Chaves Pix e Favorecidos: JWT + atendimento válido nas cinco operações. O admin só lê, altera ou exclui registros **do cliente do atendimento**; ID de registro de outro cliente → **404** (evita enumeração). Os repositories filtram sempre por `customerId` (ex.: `findById(id, customerId)`).
6. POST → 201; GET → 200; PATCH → 200; DELETE → 204 sem corpo; GET depois do DELETE → 404; DELETE repetido → 404. Listagem ordenada (`createdAt desc`) e paginada (`page`, `pageSize`, máximo 100).
7. Teste E2E com a sequência **Create → List → Get → Update → Get → Delete → Get(404)**. Nos CRUDs de Chaves Pix e Favorecidos, usar **dois clientes e dois atendimentos** para validar o isolamento.

Mapa por operação (exemplo): `POST /customer-service/pix-keys` → `authMiddleware` → `serviceSessionMiddleware` → `validate` → `PixKeyController.create` → `PixKeyService.create` → `PixKeyRepository.create` → MySQL.

## Banco de dados (modelos Prisma)

- `User` (operador/admin): `id` UUID, `name`, `email` unique, `passwordHash`, `isActive` default true, timestamps.
- `Customer`: campos da seção dos CRUDs.
- `ServiceSession`: `id` UUID, `operatorUserId` (FK User), `customerId` (FK Customer, `Restrict`), `status` (`OPEN`, `CLOSED`, `EXPIRED`), `openedAt`, `expiresAt`, `closedAt?`. Índice por `(operatorUserId, status)`. Um atendimento encontrado com `expiresAt < now` é tratado e gravado como `EXPIRED`.
- `Account`: `id` UUID, `customerId` (nullable só para SYSTEM, FK `Restrict`), `agency`, `number` (unique junto com `agency`), `type` (`CHECKING`, `SAVINGS`, `SYSTEM`), `status` (`ACTIVE`, `BLOCKED`), `blockReason?`, `blockedAt?`, `blockedByUserId?`, `balanceCents` BigInt default 0, timestamps.
- `BankTransaction`: `id` UUID, `operatorUserId`, `serviceSessionId`, `type` (`DEPOSIT`, `WITHDRAWAL`, `TRANSFER`), `transferType?` (`PIX`, `TED`, `INTERNAL`; obrigatório quando `type = TRANSFER`), `amountCents` BigInt, `feeCents` BigInt default 0, `sourceAccountId?`, `destinationAccountId?`, `pixKeyUsed?`, `description?`, `idempotencyKey`, `requestFingerprint`, `status`, `createdAt`. `UNIQUE (operatorUserId, idempotencyKey)`.
- `LedgerEntry`: `id` UUID, `transactionId`, `accountId`, `direction` (`DEBIT`, `CREDIT`), `amountCents` BigInt positivo, `createdAt`. Imutável: nunca atualizar nem apagar.
- `PixKey` e `Beneficiary`: atributos da seção dos CRUDs; índices por `customerId`; `PixKey.keyValue` unique; `PixKey.accountId` com FK `Restrict`.
- Nunca deletar fisicamente contas (não há rota de exclusão de conta).
- `balanceCents` é um saldo materializado, reconciliável com o `LedgerEntry` (rota de conciliação + teste).
- **Dinheiro sempre em centavos com `bigint`, nunca float.** O JSON recebe e devolve `amountCents`/`feeCents` como **string decimal** (ex.: `"30000"`); o Zod valida string inteira positiva, `utils/money.ts` converte para `bigint` e `utils/presenters.ts` converte de volta para string.

**MySQL 8.4 + Prisma 7:**
- Docker Compose com `mysql:8.4`, InnoDB, healthcheck, volume persistente, usuário de aplicação e **criação automática do banco de teste** (`bank_api_test`) via script de init. Valores do `.env.example` são fictícios.
- Datasource `provider = "mysql"`; URL `mysql://usuario:senha@localhost:3306/bank_api`.
- `@prisma/adapter-mariadb` (`PrismaMariaDb`) para o runtime; `DATABASE_URL` para a CLI.
- Migrations com FKs, índices, unicidade, BIGINT para centavos e `CHECK` suportado pelo MySQL 8.4:
  - `balanceCents >= 0 OR type = 'SYSTEM'` (só a SYSTEM pode ficar negativa);
  - `amountCents > 0` em transações e lançamentos;
  - `feeCents >= 0`;
  - `failedPasswordAttempts >= 0`.
- Documentar por que o MySQL alinha o trabalho aos conteúdos da disciplina.

## Regras bancárias

- Contas são abertas **dentro de um atendimento** (`CHECKING` ou `SAVINGS`), com agência fixa fictícia (`0001`) e número gerado único. Saldo inicial 0.
- **Depósito e saque** simulam o cliente entregando ou recebendo dinheiro em espécie na bancada, com contrapartida na conta interna `SYSTEM`: depósito = DEBIT na SYSTEM + CREDIT no cliente; saque = DEBIT no cliente + CREDIT na SYSTEM.
- **Transferência** = DEBIT na origem (valor + tarifa) + CREDIT no destino (valor) + CREDIT na SYSTEM (tarifa, se houver).
- A conta SYSTEM não aparece em nenhum endpoint e pode ter saldo negativo. Conta de cliente **nunca** fica negativa.
- **Bloqueio de conta** é operação geral do admin (ex.: suspeita de fraude ou pedido do cliente): `PATCH /accounts/:accountId/status` com `{ status: "BLOCKED", reason }` (motivo obrigatório, 5–200 caracteres) ou `{ status: "ACTIVE" }`. Conta bloqueada não envia nem recebe dinheiro. Não é permitido alterar o status da conta SYSTEM (404).
- Regras gerais de transferência: rejeitar valor ≤ 0, origem = destino, origem que não é do cliente do atendimento (404), destino inexistente (404), destino SYSTEM (404), conta de origem ou de destino bloqueada (422 `ACCOUNT_BLOCKED`) e saldo insuficiente para **valor + tarifa** (422 `INSUFFICIENT_FUNDS`). Depois, aplicar a regra específica do tipo (`TransferRule`).
- Débitos, créditos, lançamentos, registro da transação e idempotência acontecem em **uma única transação do Prisma** (`prisma.$transaction(async (tx) => ...)`), aberta no service. Todos os métodos de repository chamados dentro dela recebem o `tx`.
- **Proteção contra concorrência (UPDATE condicional no `AccountRepository`):** o saldo **nunca** é gravado com um valor calculado em memória; só com operações relativas:
  - `debit(accountId, amountCents, tx)` (conta de cliente): `tx.account.updateMany({ where: { id, status: 'ACTIVE', balanceCents: { gte: amount } }, data: { balanceCents: { decrement: amount } } })`. Se `count === 0`, o service relê a conta e lança `ACCOUNT_BLOCKED` ou `INSUFFICIENT_FUNDS`, e a transação faz rollback.
  - `debitSystem(amountCents, tx)`: **sem a condição `gte`** (`where: { type: 'SYSTEM' }`), porque a SYSTEM pode ficar negativa.
  - `credit(accountId, amountCents, tx)`: `updateMany({ where: { id, status: 'ACTIVE' }, data: { balanceCents: { increment: amount } } })`.
  - Atualizar as contas em ordem crescente de `id` para reduzir deadlocks. Em deadlock/lock timeout → **409 `CONCURRENT_OPERATION`**, sem retry complexo.
  - Assim, duas operações simultâneas nunca deixam a conta negativa, mesmo que as duas tenham lido o saldo antigo.
- **Idempotência:** header `Idempotency-Key` obrigatório (UUID) em depósitos, saques e transferências. `utils/idempotency.ts` gera `requestFingerprint` = SHA-256 do payload normalizado (incluindo `transferType`, destino e `customerId` do atendimento). O `BankTransaction` é inserido **dentro** da transação; se falhar por unicidade (erro Prisma `P2002`), a transação é desfeita e o service lê a existente: fingerprint igual → devolve o resultado original (200); fingerprint diferente → 409 `IDEMPOTENCY_KEY_REUSED`. Transações recusadas não gravam registro (documentado), então a mesma chave pode ser reutilizada depois de uma falha.
- O ledger fica sempre equilibrado: para cada operação, total de DEBIT = total de CREDIT. Falha parcial → rollback total.
- **Extrato** paginado por conta do cliente do atendimento, em ordem estável (`createdAt desc, id desc`), com filtros opcionais `from`, `to`, `type` e `transferType`. Cada item mostra direção (entrada/saída), tipo, tipo de transferência, valor, tarifa, contraparte mascarada e **nome do operador** que executou.
- A conta SYSTEM é criada de forma idempotente pelo seed.

## Endpoints

`GET /health` → saúde do serviço (sem revelar segredos).

### Operações gerais (JWT do admin) — 10 rotas

**Autenticação (1):**
- `POST /api/v1/auth/login` → 200, `{ accessToken, expiresIn }`; credenciais inválidas → 401 genérico.

**Clientes — CRUD 1 (5):**
- `POST /api/v1/customers` → 201
- `GET /api/v1/customers` → **todos os clientes do banco** (CPF mascarado, filtros, paginação)
- `GET /api/v1/customers/:customerId` → detalhe completo com contas
- `PATCH /api/v1/customers/:customerId`
- `DELETE /api/v1/customers/:customerId` → 204 ou 409 `CUSTOMER_HAS_HISTORY`

**Atendimentos (2):**
- `POST /api/v1/service-sessions` → abre atendimento com `{ cpf, customerPassword }`; 201 com `{ serviceSessionId, customer: { id, name, cpfMasked }, expiresAt }`
- `PATCH /api/v1/service-sessions/:serviceSessionId/close` → encerra o atendimento

**Contas (1):**
- `PATCH /api/v1/accounts/:accountId/status` → bloqueia (`{ status: "BLOCKED", reason }`) ou desbloqueia (`{ status: "ACTIVE" }`)

**Conciliação (1):**
- `GET /api/v1/ledger/reconciliation` → (a) soma de todos os DEBIT = soma de todos os CREDIT; (b) para cada conta, `balanceCents` = créditos − débitos no ledger; (c) soma de todos os saldos (incluindo SYSTEM) = 0. Retorna `{ balanced, totalDebitsCents, totalCreditsCents, mismatchedAccounts: [] }`

### Operações em nome do cliente (JWT + `X-Service-Session-Id`) — 17 rotas

**Contas do cliente (4):**
- `POST /api/v1/customer-service/accounts` → abre conta com saldo zero (`type: CHECKING | SAVINGS`)
- `GET /api/v1/customer-service/accounts` → contas do cliente do atendimento, com saldo
- `GET /api/v1/customer-service/accounts/:accountId` → detalhe da conta, com saldo e status
- `GET /api/v1/customer-service/accounts/:accountId/statement?page=1&pageSize=20&from=&to=&type=&transferType=`

**Movimentações (3):**
- `POST /api/v1/customer-service/transactions/deposits`
- `POST /api/v1/customer-service/transactions/withdrawals`
- `POST /api/v1/customer-service/transactions/transfers` ← **endpoint complexo**

**CRUD 2 — Chaves Pix (5):**
- `POST /api/v1/customer-service/pix-keys`
- `GET /api/v1/customer-service/pix-keys`
- `GET /api/v1/customer-service/pix-keys/:id`
- `PATCH /api/v1/customer-service/pix-keys/:id`
- `DELETE /api/v1/customer-service/pix-keys/:id`

**CRUD 3 — Favorecidos (5):**
- `POST /api/v1/customer-service/beneficiaries`
- `GET /api/v1/customer-service/beneficiaries`
- `GET /api/v1/customer-service/beneficiaries/:id`
- `PATCH /api/v1/customer-service/beneficiaries/:id`
- `DELETE /api/v1/customer-service/beneficiaries/:id`

### Documentação (2)
- `GET /docs` (Swagger UI; em produção, desabilitar ou proteger por configuração).
- `GET /openapi.json`.

Tags do Swagger: `Auth`, `Customers`, `ServiceSessions`, `Accounts`, `Ledger`, `CustomerService - Accounts`, `CustomerService - Transactions`, `CustomerService - PixKeys`, `CustomerService - Beneficiaries`. A descrição de cada rota informa se é **operação geral** ou **exige atendimento**.

Erros padronizados (`400/401/403/404/409/422/423/429/500`) no formato `{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "Saldo insuficiente" } }`, sem stack trace. O `errorMiddleware` converte `AppError` no status e no `code` correspondentes; erros de validação Zod → 400 `VALIDATION_ERROR` com a lista de campos inválidos; qualquer outro erro → 500 `INTERNAL_ERROR` com mensagem genérica.

**Contagem:** 10 gerais + 17 em nome do cliente = **27 funcionais**; mais `/health`, `/docs` e `/openapi.json` = **30 rotas HTTP**. Depois de implementar, conferir no OpenAPI e ajustar a matriz para o total **real**. **Mínimo do professor: 13**, já superado só pelos CRUDs (15 operações).

## Endpoint complexo obrigatório — transferência

**Identificador:** `POST /api/v1/customer-service/transactions/transfers` (não é CRUD nem autenticação).

**Headers obrigatórios:** `Authorization: Bearer <jwt-do-admin>`, `X-Service-Session-Id: <uuid>`, `Idempotency-Key: <uuid>`.

**Payload** (Zod `discriminatedUnion` por `transferType`):

```jsonc
// PIX
{ "transferType": "PIX", "sourceAccountId": "uuid", "pixKey": "bruno@exemplo.com", "amountCents": "3000", "description": "almoço" }
// TED
{ "transferType": "TED", "sourceAccountId": "uuid", "destinationAgency": "0001", "destinationAccountNumber": "123456-7", "amountCents": "2000" }
// INTERNAL
{ "transferType": "INTERNAL", "sourceAccountId": "uuid", "destinationAccountId": "uuid-da-poupanca", "amountCents": "1000" }
```

**Resposta 201:** `transactionId`, `transferType`, `amountCents`, `feeCents`, `totalDebitedCents`, `sourceAccountId`, `destination` (`{ agency, accountNumberMasked, ownerNameMasked }`), `operator` (`{ id, name }`), `serviceSessionId`, `status`, `createdAt`. Requisição repetida com a mesma chave e o mesmo payload → **200** com o mesmo corpo.

**Fluxo pelas camadas:**

```text
transaction routes ─► authMiddleware ─► serviceSessionMiddleware ─► validate
   ─► TransactionController.transfer
   ─► TransferService.transfer          (regras gerais + prisma.$transaction)
        ├─ getTransferRule(transferType) ─► PixTransferRule | TedTransferRule | InternalTransferRule
        ├─ PixKeyRepository / AccountRepository   (resolver destino)
        ├─ TransactionRepository.create           (BankTransaction + idempotência)
        ├─ AccountRepository.debit / credit / debitSystem   (UPDATE condicional)
        └─ TransactionRepository.createLedgerEntries
   ─► presenters.presentTransfer ─► resposta 201
```

**Passos no `TransferService.transfer`:**
1. Recebe os dados validados, o `customerId` e o `serviceSessionId` (do atendimento) e o `operatorUserId` (do JWT).
2. Escolhe a regra: `getTransferRule(transferType)`.
3. Abre `prisma.$transaction(async (tx) => ...)`.
4. **Resolve o destino:** PIX pela chave (`PIX_KEY_NOT_FOUND`), TED por agência + número, INTERNAL pelo ID.
5. Carrega origem e destino; confere que a origem é do **cliente do atendimento** (senão 404), que o destino não é SYSTEM, que não é a mesma conta e que nenhuma está bloqueada.
6. `rule.validate(context)` aplica a regra do tipo (`INTERNAL`: mesmo dono; `PIX`: limite noturno; `TED`: horário comercial) e `rule.calculateFee(amount)` calcula a tarifa.
7. Confere o saldo para `amount + fee` (mensagem clara de saldo insuficiente).
8. Registra a `BankTransaction` com a chave de idempotência, o operador e o atendimento.
9. Debita a origem (`amount + fee`), credita o destino (`amount`) e, se houver tarifa, credita a SYSTEM (`fee`), sempre com UPDATE condicional.
10. Grava os `LedgerEntry` (2 ou 3).
11. Commit, ou rollback total em qualquer erro.
12. O controller formata a resposta (valores como string, destino mascarado).

**Provas obrigatórias (testes):** sucesso nos três tipos; TED cobra tarifa e gera 3 lançamentos; TED fora do horário recusado; TED aceito com `TED_BUSINESS_HOURS_ENABLED=false`; Pix noturno acima do limite recusado e abaixo aceito; Pix com chave inexistente; INTERNAL para conta de outro cliente recusado; saldo insuficiente (inclusive quando só falta a tarifa); conta de origem ou destino bloqueada; origem de outro cliente (não o do atendimento); mesma conta; valor inválido; rollback; concorrência; requisição duplicada; **sem atendimento → 401; atendimento fechado ou expirado → 403; atendimento de outro operador → 403**; transação gravada com `operatorUserId` e `serviceSessionId`. O Swagger documenta os três formatos de payload com exemplos. `docs/API_FLOWS.md` traz o diagrama Mermaid desse fluxo e a justificativa da complexidade.

## Segurança e documentação

- JWT do admin com validade de 60 min, issuer, audience, algoritmo fixo e segredo via ambiente; `authMiddleware` com Bearer.
- Atendimento como **segunda camada de autorização**: nenhuma operação em nome do cliente acontece sem a senha dele.
- Argon2id para as senhas do admin e dos clientes conforme os parâmetros mínimos da OWASP; credenciais e hashes nunca aparecem em logs, respostas ou erros.
- Rate limit no login do admin, na abertura de atendimento e nas rotas de movimentação; Helmet; CORS configurável; limite de body (ex.: 100kb). HTTPS obrigatório em produção (documentar).
- Mascaramento (`utils/mask.ts`): CPF na listagem de clientes e na resposta de abertura de atendimento; número da conta e nome do titular de destino nas respostas de transferência e no extrato.
- O seed nunca contém senhas ou dados pessoais reais; o admin vem do `.env` local.
- **Swagger:** cada rota com resumo, descrição, tipo de operação (geral ou em atendimento), tag, requestBody, parâmetros, respostas, códigos de erro e exemplos fictícios; `bearerAuth` e `serviceSession` no Authorize; OpenAPI gerado a partir dos schemas Zod.
- **README em pt-BR:** contexto (tema, problema, objetivo e regra de negócio), pré-requisitos, diagrama das camadas, instalação, `.env.example`, `docker compose up -d`, migrations, `prisma generate`, seed (admin + SYSTEM), inicialização, URL do Swagger, **como autenticar o admin e abrir um atendimento no Swagger**, fluxo ponta a ponta, exemplos curl e testes.
- **`ARCHITECTURE.md`:** diagrama e responsabilidade de cada camada (Route, Middleware, Controller, Service, Repository), regras do que cada camada pode ou não fazer, padrões usados (Camadas, Repository, Service Layer, Strategy, Middleware, validação por Schema), **justificativa de cada tecnologia extra**, convenção de nomes e regra de comentários.
- **`API_FLOWS.md`:** diagramas Mermaid de login do admin, abertura de atendimento (incluindo o bloqueio por tentativas) e transferência (com os três tipos).
- **`BUSINESS_RULES.md`:** modelo de acesso (admin + atendimento), senha de atendimento e bloqueio, validade do atendimento, tipos de transferência, tarifas, horários, limites, idempotência, bloqueio de contas, auditoria e limitações da simulação (sem feriados, limite Pix por transação, sem refresh token, sem redefinição de senha, sem conferência real de documento, sem integração real).

## Material e apresentação avaliativa (grupo de quatro)

Gerar `docs/PRESENTATION_40_50_MIN.md` com roteiro de **45 minutos** para 4 pessoas (ajustável entre 40 e 50), sem nomes atribuídos:

1. **Integrante 1 — 10 min:** tema, contextualização (cliente que não consegue usar app/caixa e é atendido na bancada), objetivo da API, regra de negócio atendida, modelo de acesso (admin + atendimento autorizado pela senha do cliente), requisitos do professor × o que foi entregue e visão geral das rotas.
2. **Integrante 2 — 11 min:** tecnologias e justificativas; **arquitetura em camadas** (Route → Middleware → Controller → Service → Repository → Prisma) com o diagrama e um exemplo real percorrendo os arquivos; padrões usados (Repository, Service Layer, Strategy nas regras de transferência, Middleware, validação por Schema); nomenclatura e regra de comentários.
3. **Integrante 3 — 12 min:** Swagger ao vivo: login do admin, Authorize, **CRUD de Clientes completo** (incluindo DELETE de um cadastro feito por engano e o 409 para cliente com histórico), abertura de atendimento (senha certa, senha errada e bloqueio), **CRUD de Chaves Pix completo**, **CRUD de Favorecidos completo** e erros de validação/autorização (sem atendimento, atendimento fechado, registro de outro cliente).
4. **Integrante 4 — 12 min:** endpoint complexo: os três tipos de transferência, tarifa, horário e limite, transação atômica, idempotência e concorrência; MySQL/Prisma Studio (ledger, transações com operador e atendimento, tabela de atendimentos); bloqueio de conta e conciliação; percorrer no código `TransactionController.transfer` → `TransferService.transfer` → `PixTransferRule` → `AccountRepository.debit`; conclusão.

Incluir contingência dentro dos blocos, plano B se a demo falhar (ex.: prints e respostas salvas), checklist de falas e separação entre o que é **exibido ao vivo** e o que é **explicado em slide**. Sugestão para a demo: um integrante faz o papel do cliente e "digita" a senha no atendimento. Incluir checklist slide a slide garantindo os itens obrigatórios do PDF: **tema, contextualização, arquitetura, padrões de projeto/organização, regra de negócio principal, tecnologias**. O arquivo de slides é feito pelo grupo e enviado pelo **Google Classroom** no prazo do professor (**não inventar data**).

Gerar `docs/DEMO_CHECKLIST.md` com comandos e URLs reais:
- Subir o MySQL com Docker, configurar o `.env` (incluindo o admin), aplicar migrations, gerar o Prisma Client, rodar o seed e iniciar o Express.
- Abrir `/docs`, fazer login como admin e colocar o token no Authorize (`bearerAuth`).
- Cadastrar os clientes A e B (dados fictícios, senhas de atendimento fictícias e não sequenciais).
- **Atendimento de B:** abrir atendimento (CPF + senha de B), colocar o `serviceSessionId` no Authorize (`serviceSession`), abrir a conta corrente B1, cadastrar chave Pix por e-mail e fechar o atendimento.
- **Atendimento de A** (com valores fictícios; A abre a corrente A1 e a poupança A2, e cadastra B como favorecido via TED):
  1. Depositar R$ 100,00 em A1.
  2. `INTERNAL` R$ 10,00 de A1 para A2.
  3. `PIX` R$ 30,00 de A1 para a chave de B.
  4. `TED` R$ 20,00 de A1 para B1 (tarifa R$ 5,00), usando os dados do favorecido.
  5. Sacar R$ 5,00 de A1.
  - **Esperado:** A1 = R$ 30,00; A2 = R$ 10,00; B1 = R$ 50,00; SYSTEM = −R$ 90,00; soma de todos os saldos = 0.
- Uma transferência recusada (saldo insuficiente ou conta bloqueada) mostrando que os saldos não mudaram.
- A mesma requisição repetida com a mesma `Idempotency-Key`, mostrando que não duplica.
- Fechar o atendimento de A e mostrar que uma nova operação com o mesmo `serviceSessionId` é recusada (403).
- Senha errada 5 vezes no atendimento de um cliente → 423 bloqueado.
- Operações gerais: listar todos os clientes (CPF mascarado), ver o detalhe de A (contas e saldos), bloquear B1 com motivo e consultar a conciliação (`balanced: true`).
- **Aviso:** se a apresentação for fora do horário de TED (fim de semana ou depois das 17h), mostrar a recusa como regra de negócio e depois demonstrar o sucesso com `TED_BUSINESS_HOURS_ENABLED=false`. Se for entre 20h e 6h, o Pix de R$ 30,00 continua abaixo do limite noturno. O atendimento vale 30 min: se expirar no meio da demo, abrir outro.
- Uma lista de **`Idempotency-Key` prontas** (UUIDs fictícios distintos), uma para cada requisição da demo.
- Consultar no MySQL ou Prisma Studio as tabelas, `_prisma_migrations`, os atendimentos e os lançamentos; mostrar os arquivos de cada camada.
- Testar a sequência inteira em ambiente limpo antes da apresentação; nada de CPF, e-mail ou senha reais na tela.

Gerar `docs/REQUIREMENTS_P2.md` com a matriz de conformidade (todas as 24 linhas acima: local no código, endpoint, teste e evidência) e a seção **"Matriz de endpoints"** com **método, rota, tipo de operação (geral/atendimento), controller.método, service.método, repository, resposta e código HTTP** de cada rota. Terminar com o checklist final de entrega.

## Entrega e repositório GitHub público

- Repositório **público** feito ou publicado pelo grupo; **não** publicar nem alterar visibilidade ou remotos sem autorização explícita. No fim, fornecer checklist de comandos (`git init`, primeiro commit, `git remote add origin`, `git push`) e lembrar de enviar o link.
- Commitar código, migrations, `package.json`, **`package-lock.json`**, scripts, documentação, testes, `docker-compose.yml`, `.env.example` e `README.md`. Não versionar `.env`, credenciais, tokens, banco local, build ou dados pessoais reais.
- Fazer um **clone limpo** e verificar que o projeto instala e roda só com o que está no repositório e o `.env.example`.

## Testes / critérios de aceitação

**Testes unitários (sem banco), em `tests/unit/`:**
1. `utils/money.ts` (centavos exatos, recusa valores inválidos), `utils/cpf.ts`, `utils/customerPassword.ts` (6 dígitos, recusa repetidas e sequenciais), `utils/pixKey.ts`, `utils/bankTime.ts` (dia útil, intervalo que cruza a meia-noite), `utils/mask.ts`.
2. As três regras de transferência com relógio simulado: INTERNAL (mesmo dono), PIX (limite noturno dentro e fora do horário), TED (dentro/fora do horário, fim de semana, tarifa, regra desligada).

**Testes E2E (Supertest + banco de teste), em `tests/e2e/`:**
3. **Login do admin:** credenciais certas/erradas; JWT válido/inválido/expirado/assinado com outro segredo; sem token → 401 em todas as rotas protegidas.
4. **CRUD Clientes:** sequência completa; CPF inválido; CPF/e-mail duplicado; senha fraca recusada; `passwordHash` nunca aparece; lista com CPF mascarado e filtros; DELETE com histórico → 409; DELETE sem histórico → 204 e GET → 404.
5. **Atendimento:** senha certa abre; senha errada → 401 genérico; 5 erros → 423; acerto zera o contador; abrir novo fecha o anterior do mesmo operador; fechar funciona; atendimento expirado, fechado ou de outro operador é recusado; rota em nome do cliente sem header → 401.
6. **Isolamento por cliente:** no atendimento de A não é possível ler, alterar nem movimentar dados ou contas de B (404).
7. **Contas:** abertura com saldo 0 e número único; listagem e detalhe com saldo; bloqueio com motivo obrigatório e desbloqueio pela rota de status; SYSTEM inacessível.
8. **Depósito/saque:** saldo, lançamentos duplos, histórico, saldo insuficiente, conta bloqueada, valor zero/negativo; **depósito funciona com a SYSTEM negativa**.
9. **Transferências:** todos os casos listados em "Provas obrigatórias".
10. **Rollback:** falha no meio da transferência não deixa saldo parcial nem ledger incompleto.
11. **Concorrência:** operações simultâneas (`Promise.all`) não deixam saldo negativo nem duplicam dinheiro.
12. **Idempotência:** mesma chave + mesmo payload → mesmo resultado; payload diferente → 409; requisições simultâneas deduplicadas.
13. **Extrato:** paginação, ordem, filtros, nome do operador e isolamento entre clientes.
14. **Conciliação:** `balanced: true` depois do cenário da demo.
15. **CRUD Chaves Pix:** sequência completa; CPF diferente do cliente recusado; chave duplicada → 409; limite de 5 por conta; RANDOM gerada pelo servidor; PATCH só move de conta; conta de outro cliente recusada; isolamento entre atendimentos.
16. **CRUD Favorecidos:** sequência completa; destino inexistente, SYSTEM ou do próprio cliente recusado; PATCH revalida o destino; exclusão não altera o histórico; isolamento entre atendimentos.
17. **Swagger:** `/docs` responde; `/openapi.json` válido, com todas as rotas, os dois esquemas de segurança e os três exemplos de transferência.

**Critérios finais:**
18. **Requisitos P2:** 13+ endpoints reais; 3 CRUDs completos; endpoint complexo identificado e testado; documentação e migrations MySQL conferidas.
19. **Qualidade:** `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` sem falhas; o lint detecta `snake_case` indevido; nenhum controller importa `prisma`; nenhum repository contém regra de negócio; **conferir por amostragem que toda função/método tem o comentário de uma linha em pt-BR**.

Testes E2E usam **somente o banco de teste** (`TEST_DATABASE_URL`). **Limpar o banco de teste entre suítes é permitido e esperado** (truncate em ordem segura de FKs). **Nunca** limpar nem resetar o banco de desenvolvimento sem confirmação explícita. Não invente resultados: execute o que for possível e relate o que não conseguiu rodar.

## Scripts npm esperados

- `dev` — Express em watch com `tsx`.
- `build`, `start`, `typecheck`, `lint`, `format`.
- `test`, `test:unit`, `test:e2e`.
- `db:generate` — `prisma generate`.
- `db:migrate` — `prisma migrate dev`.
- `db:seed` — `prisma db seed` (configurado em `prisma.config.ts`).
- `db:studio` — `prisma studio`.
- `db:test:prepare` — `prisma migrate deploy` apontando para `TEST_DATABASE_URL`.

`.env.example` (valores fictícios): `DATABASE_URL`, `TEST_DATABASE_URL`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ACCESS_TOKEN_TTL=60m`, `PORT`, `CORS_ORIGIN`, `NODE_ENV`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SERVICE_SESSION_TTL_MINUTES=30`, `CUSTOMER_MAX_PASSWORD_ATTEMPTS=5`, `CUSTOMER_PASSWORD_LOCK_MINUTES=15`, `BANK_TIMEZONE=America/Sao_Paulo`, `TED_FEE_CENTS=500`, `TED_BUSINESS_HOURS_ENABLED=true`, `TED_START_TIME=06:30`, `TED_END_TIME=17:00`, `PIX_NIGHT_START=20:00`, `PIX_NIGHT_END=06:00`, `PIX_NIGHT_LIMIT_CENTS=100000`, `PIX_KEYS_PER_ACCOUNT=5`. Todas validadas com Zod em `config/env.ts`.

## Execução passo a passo pelo Codex

Execute **em fases**. Ao fim de cada fase, rode typecheck, lint e testes da fase e **pare para revisão humana** antes de seguir, apresentando um resumo do que foi feito.

1. **Fundação:** examinar o repositório (se vazio, criar projeto npm ESM/TypeScript; não sobrescrever arquivos existentes). Criar `AGENTS.md` com as regras desta especificação (arquitetura em camadas e o que cada camada pode fazer, camelCase/PascalCase, nomes de métodos por operação, **comentário acima de cada função**, definição de pronto) e `docs/ARCHITECTURE.md`. Configurar ESLint, Prettier, Vitest, Docker Compose MySQL 8.4 (com banco de teste), Prisma 7 com o adapter, `config/env.ts`, `AppError`, `errorMiddleware` e `app.ts`; testar a conexão e o `/health`.
2. **Utils + regras de transferência:** `money`, `cpf`, `customerPassword`, `pixKey`, `bankTime`, `clock`, `mask`, `password`, `token`, `idempotency` e as três `TransferRule`, com testes unitários.
3. **Admin + Clientes:** modelos Prisma de User/Customer, seed (SYSTEM + admin), login e CRUD de clientes (route → controller → service → repository), com testes E2E.
4. **Atendimento:** abrir, fechar, `serviceSessionMiddleware`, bloqueio por tentativas, com testes.
5. **Contas:** abertura, listagem, detalhe e extrato (vazio por enquanto) em atendimento; rota de status (bloquear/desbloquear); com testes. *(Precisa vir antes dos CRUDs de Chaves Pix e Favorecidos, que dependem de contas.)*
6. **CRUDs de Chaves Pix e Favorecidos:** modelos, isolamento por atendimento, Swagger e testes E2E completos. Só seguir com os dois 100% funcionais.
7. **Movimentações:** depósito, saque e transferência (PIX/TED/INTERNAL) com `prisma.$transaction`, ledger, tarifa, idempotência, UPDATE condicional e auditoria; extrato completo; testes.
8. **Conciliação:** rota do ledger, com teste.
9. **Swagger e acabamento:** documentação completa com os dois esquemas no Authorize, respostas padronizadas, segurança (Helmet, CORS, rate limit, limite de body).
10. **Validação ponta a ponta:** typecheck, lint, testes, build, migrations e execução real do cenário da demo, conferindo os saldos esperados (A1 R$ 30,00, A2 R$ 10,00, B1 R$ 50,00, SYSTEM −R$ 90,00) e a conciliação `balanced: true`.
11. Corrigir erros até a API rodar. Não declarar concluído com funcionalidade principal quebrada. Se o ambiente não permitir banco/testes, documentar o bloqueio exato sem fingir validação.
12. **Documentação final:** `REQUIREMENTS_P2.md` (com a matriz de endpoints), `PRESENTATION_40_50_MIN.md`, `DEMO_CHECKLIST.md`, `BUSINESS_RULES.md`, `API_FLOWS.md` e README executável.
13. Teste de instalação a partir de clone limpo, se o ambiente permitir. Não publicar o GitHub nem enviar slides.
14. **Relatório final em português:** o que foi criado, árvore final, comandos executados e resultados, rotas (gerais × em atendimento), Swagger, como iniciar localmente, arquivos por camada, checklist P2 e limitações.

**Prioridade:** cumprir **todos** os requisitos do PDF (13+ endpoints, 3 CRUDs completos, endpoint complexo, segurança, arquitetura em camadas, nomenclatura padronizada, README, GitHub público, material de apresentação e demo) **e** o escopo do grupo: sistema do admin master com atendimento autorizado pelo cliente, transferências PIX/TED/INTERNAL, auditoria, camelCase e comentários em cada função. Código **simples, legível e fácil de explicar por estudantes**, com responsabilidades claras por camada, fluxos rastreáveis e testes automáticos. Não criar frontend. Não integrar Pix real, cartões, instituições financeiras ou dinheiro real. Implementar tudo o que está marcado como essencial, sem pseudocódigo.

### Documentação oficial de referência

- Prisma 7: https://www.prisma.io/docs/orm/v7
- Prisma 7 + MySQL: https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/mysql
- Prisma 7 quickstart MySQL: https://www.prisma.io/docs/v7/prisma-orm/quickstart/mysql
- Prisma 7 Client: https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction
- Prisma 7 transactions: https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions
- Express 5: https://expressjs.com/en/guide/migrating-5.html
- OWASP Password Storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Zod to OpenAPI: https://github.com/asteasolutions/zod-to-openapi
- Swagger UI Express: https://www.npmjs.com/package/swagger-ui-express
