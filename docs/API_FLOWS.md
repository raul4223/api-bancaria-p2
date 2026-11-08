# Fluxos da API

## Login do operador master

```mermaid
sequenceDiagram
  actor Admin as Operador
  participant Route as Route / Middleware
  participant Controller as AuthController
  participant Service as AuthService
  participant Repository as UserRepository
  participant DB as Prisma / MySQL
  Admin->>Route: POST /api/v1/auth/login
  Route->>Route: valida body com Zod e limita tentativas
  Route->>Controller: login
  Controller->>Service: login(email, password)
  Service->>Repository: localizar operador ativo
  Repository->>DB: findActiveByEmail
  DB-->>Service: operador e hash
  Service->>Service: verificar Argon2id e emitir JWT HS256
  Service-->>Admin: 200 accessToken, tokenType e expiresIn
```

Credenciais incorretas respondem 401 com mensagem genérica. O JWT fixa algoritmo, emissor, audiência e validade de 60 minutos.

## Abertura do atendimento

```mermaid
sequenceDiagram
  actor Admin as Operador autenticado
  actor Customer as Cliente
  participant Route as Middleware / Controller
  participant Service as ServiceSessionService
  participant Repo as CustomerRepository / ServiceSessionRepository
  participant DB as Prisma / MySQL
  Customer->>Admin: confirma CPF e senha de atendimento
  Admin->>Route: POST /api/v1/service-sessions
  Route->>Service: open(cpf, customerPassword, operatorUserId)
  Service->>Repo: localizar cliente e estado de bloqueio
  Repo->>DB: consultar cadastro
  DB-->>Service: cliente e hash Argon2id
  alt senha incorreta
    Service->>Repo: incrementar tentativas e bloquear na 5ª
    Service-->>Admin: 401 genérico ou 423 durante o bloqueio
  else senha correta
    Service->>Repo: zerar tentativas, fechar atendimento anterior e criar novo
    Service-->>Admin: 201 atendimento com CPF mascarado e expiração
  end
```

O middleware de atendimento exige `X-Service-Session-Id`, verifica operador, status e expiração e coloca o cliente autorizado no contexto da requisição. Sem o header, responde 401; sessão fechada, expirada ou de outro operador responde 403.

## Transferência PIX, TED ou interna

```mermaid
flowchart TD
  A[POST /customer-service/transactions/transfers] --> B[JWT + atendimento + headers validados]
  B --> C[TransferService valida origem e resolve destino]
  C --> D{Tipo}
  D -->|PIX| E[Localiza chave e aplica limite noturno]
  D -->|TED| F[Localiza agência e conta; aplica horário e tarifa]
  D -->|INTERNAL| G[Exige mesmo titular]
  E --> H[Confere titularidade, status e saldo + tarifa]
  F --> H
  G --> H
  H --> I[Inicia transação Prisma]
  I --> J[Cria BankTransaction com operador, sessão e idempotência]
  J --> K[UPDATE condicional: débito na origem]
  K --> L[Crédito no destino e, se TED, crédito da tarifa na SYSTEM]
  L --> M[Grava 2 ou 3 partidas no ledger]
  M --> N[Persiste resposta e confirma transação]
  N --> O[201; repetição idempotente retorna 200]
  K -->|erro| P[Rollback integral; nenhuma partida parcial]
  L -->|erro| P
  M -->|erro| P
```

As três regras estão em `src/services/transfer-rules/`. O fluxo real percorre `src/routes/customer-service.routes.ts` → `src/controllers/TransactionController.ts` → `src/services/TransferService.ts` → regra Strategy e repositories → Prisma. A atualização condicional é o controle de concorrência que impede saldo negativo.
