# Regras do projeto

- Idioma dos documentos, respostas e comentários: português do Brasil; identificadores em inglês.
- Arquitetura obrigatória: Route → Middleware → Controller → Service → Repository → Prisma/MySQL.
- Route apenas liga caminhos, middlewares e métodos de controller.
- Controller trata HTTP; não importa Prisma nem contém regras de negócio.
- Service concentra as regras, validações de negócio e transações; não conhece `req` ou `res`.
- Repository acessa o banco por Prisma e não decide regras de negócio.
- Middlewares cuidam de autenticação, atendimento, validação, rate limit e erros.
- Funções, métodos, variáveis, parâmetros, propriedades e instâncias usam camelCase; classes, tipos e enums usam PascalCase; membros de enums usam UPPER_CASE.
- Operações CRUD usam `create`, `list`/`findMany`, `getById`/`findById`, `update` e `delete`.
- Cada classe e cada função/método/arrow function nomeada tem comentário curto em pt-BR imediatamente acima, no infinitivo. Casos de teste podem usar o título do teste.
- Não gravar credenciais reais, hashes, tokens ou dados pessoais reais; não versionar `.env`.
- Migrations ficam versionadas. Testes E2E só usam `TEST_DATABASE_URL`; nunca resetar o banco de desenvolvimento.
- Pronto significa typecheck, lint, testes, build, migrations e fluxo real da demo verificados, ou limitações de ambiente descritas sem alegar sucesso.
