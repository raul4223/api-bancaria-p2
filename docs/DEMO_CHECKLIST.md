# Checklist da demonstração

Use apenas dados fictícios e um banco local descartável. Para reproduzir o cenário de saldos, comece com contas sem movimentações. Não apague volumes nem reinicie um banco que contenha dados que o grupo queira preservar.

## 1. Preparar o ambiente

```bash
cp .env.example .env
# Edite ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD e JWT_SECRET.
docker compose up -d mysql
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Confirme `/health` em `http://localhost:3000/health`. Abra Swagger em `http://localhost:3000/docs`. Prisma Studio, se for útil para a demo, abre com `npm run db:studio`.

## 2. Autenticar e preparar clientes

Use o admin local configurado no `.env` em `POST /api/v1/auth/login` e copie `accessToken` para `bearerAuth` em **Authorize**. Os valores abaixo são fictícios e podem ser usados apenas numa base local descartável:

| Cliente | CPF fictício  | Senha de atendimento fictícia | E-mail           |
| ------- | ------------- | ----------------------------- | ---------------- |
| A       | `52998224725` | `291847`                      | `a@example.test` |
| B       | `11144477735` | `847291`                      | `b@example.test` |

Cadastre os dois em `POST /api/v1/customers`. Senhas têm seis dígitos e não podem ser repetidas ou sequenciais.

## 3. Atendimento de B

1. Abra `POST /api/v1/service-sessions` com CPF e senha de B. Guarde `id` da resposta.
2. No Swagger, informe esse ID em `serviceSession` (`X-Service-Session-Id`).
3. Abra conta corrente em `POST /api/v1/customer-service/accounts` com `{"type":"CHECKING"}`. Guarde o ID como `B1`.
4. Cadastre uma chave `EMAIL` em `POST /api/v1/customer-service/pix-keys`, vinculada a `B1`, com `b@example.test`.
5. Feche o atendimento em `PATCH /api/v1/service-sessions/{serviceSessionId}/close`.

## 4. Atendimento de A e cadastro do favorecido

1. Abra atendimento para A e configure o novo `id` em `serviceSession`.
2. Abra `CHECKING` e `SAVINGS`; guarde os IDs como `A1` e `A2`.
3. Cadastre B como favorecido TED, usando agência `0001` e o número de `B1`.

## 5. Cenário financeiro

Cada operação de depósito, saque ou transferência precisa de um `Idempotency-Key` UUID único. Estes UUIDs são exemplos fictícios; use um diferente em cada operação:

```text
e7000000-0000-4000-8000-000000000001  depósito
e7000000-0000-4000-8000-000000000002  INTERNAL
e7000000-0000-4000-8000-000000000003  PIX
e7000000-0000-4000-8000-000000000004  TED
e7000000-0000-4000-8000-000000000005  saque
```

Com o atendimento de A selecionado:

1. Deposite `10000` centavos (R$ 100,00) em A1.
2. Transfira `1000` centavos (R$ 10,00) de A1 para A2 com `transferType=INTERNAL`.
3. Transfira `3000` centavos (R$ 30,00) de A1 para a chave Pix de B.
4. Transfira `2000` centavos (R$ 20,00) de A1 para B1 com `transferType=TED`. A tarifa padrão é `500` centavos (R$ 5,00). O saldo da origem cobre valor e tarifa.
5. Saque `500` centavos (R$ 5,00) de A1.

O resultado esperado é:

| Conta           | Saldo esperado |
| --------------- | -------------: |
| A1              |       R$ 30,00 |
| A2              |       R$ 10,00 |
| B1              |       R$ 50,00 |
| SYSTEM          |      −R$ 90,00 |
| Soma dos saldos |        R$ 0,00 |

Se a demonstração ocorrer fora do horário configurado de TED, mostre primeiro a recusa e, para demonstrar o sucesso, ajuste localmente `TED_BUSINESS_HOURS_ENABLED=false` e reinicie a API. Entre 20h e 6h, PIX de R$ 30,00 fica abaixo do limite noturno padrão de R$ 1.000,00.

## 6. Idempotência, saldo e bloqueios

- Repita uma requisição financeira com a mesma chave e o mesmo payload: a API deve retornar HTTP 200 com o mesmo ID. O saldo não muda pela segunda chamada.
- Use a mesma chave com payload diferente: a API deve retornar HTTP 409.
- Demonstre uma tentativa recusada por saldo insuficiente; confira que saldo e ledger não mudaram.
- Feche o atendimento de A e tente movimentar com o mesmo ID: resposta esperada HTTP 403.
- Bloqueie B1 com motivo usando `PATCH /api/v1/accounts/{accountId}/status`, mostre uma operação recusada e reative a conta.
- Para demonstrar o bloqueio de senha, envie cinco senhas incorretas ao abrir um atendimento para um cliente fictício: resposta final HTTP 423. O bloqueio local dura 15 minutos.

## 7. Auditoria e conciliação

- Faça `GET /api/v1/ledger/reconciliation`; o resultado esperado é `balanced: true`.
- Mostre a listagem geral de clientes e confirme CPF mascarado; mostre o detalhe de A e suas contas.
- No Prisma Studio, mostre `ServiceSession`, `BankTransaction`, `LedgerEntry`, `_prisma_migrations` e as contas.
- Confirme que a transação contém operador e atendimento, que a TED tem três partidas e que débito = crédito.
- Percorra o fluxo no código: `TransactionController.transfer` → `TransferService.transfer` → Strategy → `AccountRepository.debit`.

## 8. Demonstração de rota via curl (opcional)

Preencha os placeholders localmente; não cole tokens ou credenciais reais em documentação ou slides:

```bash
curl -sS http://localhost:3000/health

curl -sS -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ADMIN_EMAIL_LOCAL","password":"ADMIN_PASSWORD_LOCAL"}'

curl -sS -X POST http://localhost:3000/api/v1/service-sessions \
  -H 'Authorization: Bearer TOKEN_LOCAL' \
  -H 'Content-Type: application/json' \
  -d '{"cpf":"52998224725","customerPassword":"291847"}'

curl -sS -X POST http://localhost:3000/api/v1/customer-service/transactions/transfers \
  -H 'Authorization: Bearer TOKEN_LOCAL' \
  -H 'X-Service-Session-Id: SERVICE_SESSION_ID_LOCAL' \
  -H 'Idempotency-Key: e7000000-0000-4000-8000-000000000003' \
  -H 'Content-Type: application/json' \
  -d '{"transferType":"PIX","sourceAccountId":"ACCOUNT_A1_ID","amountCents":"3000","pixKey":"b@example.test"}'
```

## 9. Plano B e entrega

- Salve capturas fictícias do Swagger, das respostas, do ledger e da conciliação antes da apresentação. Se a infraestrutura falhar, identifique a exibição como contingência e explique o fluxo pelo código.
- Teste o cenário inteiro num ambiente local limpo antes da apresentação; não use CPF, telefone, e-mail ou senha de pessoas reais.
- O grupo prepara os slides finais, publica o repositório no GitHub com a visibilidade exigida e envia os slides pelo Google Classroom no prazo do professor. A data não foi informada no PDF disponível.
