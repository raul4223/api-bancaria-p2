# Roteiro de apresentação — 45 minutos

Roteiro para quatro integrantes, sem atribuição de nomes. Pode variar entre 40 e 50 minutos reduzindo ou ampliando as demonstrações. O arquivo de slides final é preparado pelo grupo.

## Divisão de tempo

| Bloco     |    Duração | Integrante        | Foco                                                      |
| --------- | ---------: | ----------------- | --------------------------------------------------------- |
| 1         |     10 min | Integrante 1      | Tema, problema, objetivo, regra de negócio e rotas        |
| 2         |     11 min | Integrante 2      | Tecnologias, camadas, padrões e organização do código     |
| 3         |     12 min | Integrante 3      | Swagger, autenticação, atendimentos e três CRUDs          |
| 4         |     12 min | Integrante 4      | Transferências, concorrência, ledger, banco e conciliação |
| **Total** | **45 min** | **4 integrantes** |                                                           |

## Bloco 1 — contexto e escopo (10 min)

1. **Tema e problema (2 min; slide):** atendimento bancário presencial a pessoas que não conseguem usar o aplicativo ou caixa eletrônico sem ajuda.
2. **Objetivo (2 min; slide):** permitir ao operador atender um cliente com autorização explícita, guardar auditoria e preservar a consistência dos saldos.
3. **Regra principal (3 min; slide):** o operador master autentica com JWT; o cliente confirma sua senha para abrir atendimento; PIX, TED e INTERNAL obedecem regras próprias.
4. **Escopo P2 (2 min; slide):** 27 rotas funcionais, três CRUDs completos, endpoint complexo, Swagger, banco relacional, testes e documentação.
5. **Visão geral (1 min; slide):** mostrar os grupos de rotas gerais e de atendimento.

Fala importante: esta é uma simulação acadêmica. Não existe integração com banco real, Pix real ou movimentação financeira.

## Bloco 2 — tecnologia e arquitetura (11 min)

1. **Stack e justificativas (3 min; slide):** MySQL 8.4 e Prisma 7 alinham persistência e migrations à disciplina; TypeScript, Express 5, Zod, Argon2id, JWT, Swagger, Vitest, Supertest, Helmet e rate limit atendem tipagem, validação, segurança, documentação e testes.
2. **Diagrama de camadas (3 min; slide):** Route → Middleware → Controller → Service → Repository → Prisma/MySQL.
3. **Exemplo no código (3 min; ao vivo):** percorrer `src/routes/customer-service.routes.ts` → `src/controllers/TransactionController.ts` → `src/services/TransferService.ts` → `src/services/transfer-rules/PixTransferRule.ts` → `src/repositories/AccountRepository.ts`.
4. **Padrões e convenções (2 min; slide):** camada de serviço, Repository, Strategy para regras de transferência, middleware em cadeia, schemas Zod, camelCase/PascalCase e comentário curto em português acima das funções.

## Bloco 3 — Swagger e cadastros (12 min)

1. **Login (1 min; ao vivo):** autenticar no `/docs` com o admin de demonstração e usar `bearerAuth`.
2. **CRUD Clientes (2 min; ao vivo):** mostrar o cadastro abrindo automaticamente a primeira conta (agência e número), listagem com CPF mascarado e contas, busca pelo CPF, alteração e exclusão de cadastro sem histórico; explicar o 409 quando existe histórico.
3. **Atendimento (2 min; ao vivo):** abrir com senha correta; mostrar erro genérico para senha errada; explicar bloqueio após cinco falhas e fechamento automático do atendimento anterior.
4. **CRUD Chaves Pix (3 min; ao vivo):** criar chave RANDOM, listar, consultar, mover entre contas do mesmo cliente, consultar de novo e excluir.
5. **CRUD Favorecidos (3 min; ao vivo):** criar destino TED, listar, consultar, atualizar apelido e excluir; mostrar que destino próprio ou inexistente é recusado.
6. **Autorização e validação (1 min; ao vivo):** demonstrar header de atendimento ausente, atendimento encerrado e tentativa de acessar registro de outro cliente.

## Bloco 4 — movimentações e auditoria (12 min)

1. **PIX/TED/INTERNAL (3 min; ao vivo + slide):** mostrar que cada tipo usa uma chave, dados de conta ou ID e regra Strategy própria.
2. **Atomicidade, idempotência e concorrência (3 min; slide):** explicar transação Prisma, chave idempotente, débito condicional e rollback; repetir uma chamada e mostrar HTTP 200 sem duplicação.
3. **Ledger e banco (3 min; ao vivo):** abrir Prisma Studio e percorrer `BankTransaction`, `LedgerEntry` e `ServiceSession`; apontar operador e atendimento gravados.
4. **Bloqueio e conciliação (2 min; ao vivo):** bloquear uma conta com motivo e executar `GET /api/v1/ledger/reconciliation`, com `balanced: true`.
5. **Conclusão (1 min; slide):** recapitular contexto, requisitos atendidos e limitações da simulação.

## Checklist slide a slide

1. Título do projeto e identificação do grupo de quatro integrantes.
2. Contexto do atendimento presencial e público beneficiado.
3. Problema, objetivo e regra de negócio atendida.
4. Escopo simulado e o que não integra (bancos, Pix real e dinheiro real).
5. Requisitos do professor e visão dos 27 endpoints funcionais.
6. Tecnologias e justificativas.
7. Diagrama Route → Middleware → Controller → Service → Repository → Prisma/MySQL.
8. Padrões: camadas, Repository, Service Layer, Strategy, Middleware e schema.
9. Modelo de acesso: admin JWT + consentimento do cliente por atendimento.
10. Regras de PIX, TED e INTERNAL.
11. Idempotência, transação, saldo condicional e rollback.
12. Testes e critérios de qualidade.
13. Demonstração do Swagger e dos CRUDs.
14. Demonstração do ledger, auditoria e conciliação.
15. Limitações, conclusão e perguntas.

## Contingência

- Antes da apresentação, salvar capturas fictícias do Swagger, respostas principais, ledger e conciliação. Se uma dependência falhar, explicar o fluxo pelo material salvo e pelo código, identificando a demonstração como contingência.
- Se a TED estiver fora do horário, mostrar a recusa e depois reiniciar a API com `TED_BUSINESS_HOURS_ENABLED=false` para apresentar o caso aceito. Não altere a regra em produção.
- Se o atendimento expirar durante a fala, abra outro com a senha fictícia de demonstração.
- Não exibir CPF, e-mail ou senha de pessoas reais. Não usar contas ou credenciais pessoais.

## Entrega da disciplina

O grupo prepara e revisa o arquivo final de slides, publica o repositório no GitHub com a visibilidade solicitada pelo professor e envia o material pelo Google Classroom no prazo informado pelo professor. O prazo não consta no material consultado; não invente uma data.
