# Regras de negócio

Este projeto é uma simulação acadêmica. Nenhum fluxo acessa bancos, o Banco Central, SPI ou STR. Não existe dinheiro real.

## Acesso e atendimento

- Só o operador master, criado pelo seed, autentica na API com JWT. Não existe rota de cadastro de operadores.
- O cliente não recebe JWT. O operador informa CPF e senha de atendimento em `POST /api/v1/service-sessions`; a resposta não revela hash e mascara o CPF.
- A senha tem seis dígitos, é armazenada com Argon2id e não pode ser repetida (`111111`) nem sequencial (`123456` ou `654321`). Após cinco erros consecutivos, novas tentativas ficam bloqueadas por 15 minutos. Um acerto zera a contagem.
- O atendimento dura 30 minutos por padrão. Um novo atendimento do mesmo operador encerra o anterior. Toda operação em nome do cliente exige um atendimento aberto, não expirado e pertencente ao operador do JWT.
- O `customerId` é obtido do atendimento, nunca do corpo da requisição. IDs de contas, chaves e favorecidos de outro cliente retornam 404.
- Redefinição de senha, recuperação de acesso e conferência documental não fazem parte desta versão.

## Identificação de clientes e contas

- Exclusão de cliente (`DELETE /api/v1/customers/{cpf}`) serve só para cadastro feito por engano: remove o cliente e a conta aberta no cadastro quando ele **nunca teve atendimento, nenhuma conta foi movimentada (nem recebendo transferências) e todos os saldos são zero**. Com qualquer histórico a API devolve 409 `CUSTOMER_HAS_HISTORY`, preservando ledger e auditoria.

- No balcão, o funcionário identifica o cliente pelo **CPF** do documento, não por um código interno. Por isso o CRUD de clientes usa o CPF na rota: `GET`, `PATCH` e `DELETE /api/v1/customers/{cpf}`. O UUID continua como chave interna no banco e nas relações (contas, atendimentos), mas não é exigido nas rotas.
- A listagem geral mostra o CPF mascarado (`***.982.247-**`) e, para cada cliente, a agência e o número de cada conta, o tipo e o status. O CPF completo aparece só na consulta individual, para o operador conferir com o documento.
- Toda conta de cliente tem **agência `0001` e um número de 7 dígitos** gerado pelo banco. Depósito, saque, transferência (`sourceAccountNumber` e, na INTERNAL, `destinationAccountNumber`), extrato, consulta de conta, bloqueio e chaves Pix identificam a conta pelo número. A TED informa agência e número de destino.
- Limitação: o CPF na URL pode aparecer em logs de servidor e no histórico do navegador. Em produção, a busca seria feita por `POST` com o CPF no corpo, sempre sob HTTPS.

## Contas e movimentações

- **O cadastro do cliente já abre a primeira conta**, na mesma transação: corrente (`CHECKING`) por padrão, ou poupança (`SAVINGS`) com `accountType`. Assim, como num banco real, o cliente sai do cadastro com agência e número de conta. Cliente e conta continuam em tabelas separadas, porque uma pessoa pode ter várias contas.
- Contas adicionais são abertas dentro de um atendimento (`POST /api/v1/customer-service/accounts`), com saldo zero. A agência fictícia é `0001`; o número (7 dígitos) é gerado pelo servidor.
- A conta `SYSTEM` é criada pelo seed, não aparece nos endpoints de atendimento e funciona como contrapartida de espécie e tarifa. Ela pode ficar negativa.
- Contas de clientes não podem ter saldo negativo. Depósito, saque e transferência usam `bigint` em centavos; o débito é um `UPDATE` condicional no banco (`status = ACTIVE` e saldo suficiente). Não se calcula nem se grava um saldo novo a partir de uma leitura em memória.
- Depósito: débito na SYSTEM e crédito na conta do cliente. Saque: débito no cliente e crédito na SYSTEM.
- Transferência: débito na origem pelo valor mais tarifa, crédito do valor no destino e crédito da tarifa na SYSTEM, quando existir.
- Débitos, créditos, transação, resultado idempotente e lançamentos de ledger participam de uma única transação Prisma. Uma falha faz rollback de tudo.
- O ledger registra partidas imutáveis. Para cada movimento, a soma dos débitos é igual à soma dos créditos. A rota de conciliação também compara o saldo de cada conta com seu ledger.
- Conta bloqueada não envia nem recebe. O admin bloqueia com motivo; a SYSTEM não pode ser bloqueada por rota.

## Tipos de transferência simulada

| Tipo       | Destino                                                    | Regra                                                        | Tarifa padrão |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------ | ------------: |
| `INTERNAL` | Número de outra conta do mesmo cliente                     | 24 horas; não pode enviar à própria conta                    |       R$ 0,00 |
| `PIX`      | Chave cadastrada (CPF, e-mail, telefone ou UUID aleatório) | 24/7; limite noturno por operação                            |       R$ 0,00 |
| `TED`      | Agência e número de conta                                  | Dias úteis, das 06:30 às 17:00 se a regra estiver habilitada |       R$ 5,00 |

Os horários usam `BANK_TIMEZONE=America/Sao_Paulo`. O limite noturno do PIX, padrão R$ 1.000,00 entre 20:00 e 06:00, é por transação nesta simplificação; o sistema não agrega operações do período. Feriados não são considerados. `TED_BUSINESS_HOURS_ENABLED=false` permite a demonstração da transferência fora do horário.

## Chaves Pix e favorecidos

- O valor de cada chave Pix é único no banco. CPF só pode ser o CPF do cliente atendido. Chaves `RANDOM` são UUIDs gerados pelo servidor. Cada conta aceita no máximo cinco chaves.
- Uma chave pode ser movida apenas para outra conta ativa do mesmo cliente. Tipo e valor ficam imutáveis.
- Favorecidos guardam um destino PIX ou TED. O destino precisa existir, estar ativo, não ser SYSTEM e pertencer a outro cliente.
- Um favorecido salvo não autoriza uma transferência; o destino e suas regras são conferidos novamente na movimentação.
- A exclusão de uma chave ou favorecido não altera transações anteriores. A chave usada fica registrada na transação.

## Idempotência e auditoria

- Depósitos, saques e transferências exigem `Idempotency-Key` em UUID.
- Mesma chave, operador e payload normalizado devolvem o resultado já gravado com HTTP 200 e não repetem a movimentação. Mesmo operador e chave com outro payload retorna HTTP 409.
- Operações recusadas não deixam transação ou lançamento parcial; a chave pode ser usada depois de uma falha recusada.
- Cada transação concluída armazena o operador, o atendimento, as contas, o valor, a tarifa, o fingerprint, a chave e a resposta original.
- A listagem de clientes mascara CPF; transferências e extrato mascaram número da conta e nome do titular da contraparte. Nenhuma resposta inclui hash de senha.

## Limites desta versão

- PIX, TED e INTERNAL são operações no mesmo banco fictício; não há conexão financeira real.
- Não há feriados, limite PIX acumulado por período, refresh token, recuperação de senha, perfis múltiplos de operador nem conferência de documento.
- A API é demonstrativa e não deve ser usada para processar dados reais ou dinheiro real.
