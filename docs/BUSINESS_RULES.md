# Regras de Negócio

> Toda regra de negócio implementada no código deve estar documentada aqui.
> Se você alterar uma regra no código, atualize esta página no mesmo commit/sessão.

## Cartões de Crédito

### RN-01 — Uma fatura por cartão/ano/mês
- **Descrição:** cada combinação `(card_name, year, month)` admite no máximo
  um registro em `credit_cards`.
- **Objetivo:** impedir lançamento duplicado da mesma fatura.
- **Comportamento esperado:** `POST /api/credit-cards` retorna `409` com o
  registro existente se já houver fatura para o mês; o frontend usa
  `GET /api/credit-cards/check` **antes** de submeter, para decidir entre
  "Atualizar valor" e "Manter lançamento anterior" sem sequer tentar o POST.
- **Exceções:** nenhuma — a checagem vale para qualquer ano/mês/cartão.
- **Impacto:** `UNIQUE (card_name, year, month)` no banco garante a regra
  mesmo em corrida entre requisições simultâneas.

### RN-02 — Cartões suportados são fixos
- **Descrição:** `card_name` só aceita `'bradesco'` ou `'nubank'`.
- **Objetivo:** o sistema foi desenhado para os dois cartões reais do usuário,
  não é um cadastro genérico de cartões.
- **Comportamento esperado:** qualquer outro valor retorna `422`.
- **Exceções:** para adicionar um novo cartão é preciso alterar o `CHECK` no
  banco (nova migration), a constante `VALID_CARDS` em
  `worker/src/routes/creditCards.js` e a UI em `index.html`/`js/app.js`.
- **Impacto:** validado em 2 camadas (banco `CHECK` + API `validateCardName`).

### RN-03 — Atualização de fatura preserva o valor anterior
- **Descrição:** `PUT /api/credit-cards/:id` move o valor atual para
  `previous_value` antes de gravar o novo `value`.
- **Objetivo:** permitir à interface mostrar "último valor registrado" quando
  o usuário reabre o mês (ex.: fatura parcial antes do fechamento).
- **Comportamento esperado:** cada UPDATE sobrescreve `previous_value` com o
  valor imediatamente anterior (não é um histórico de N versões — só a
  última).
- **Exceções:** nenhuma.
- **Impacto:** cada UPDATE grava uma entrada em `audit_log` com o histórico
  real, caso um retrospecto mais longo seja necessário.

## Tipos de Despesa (taxonomias)

### RN-04 — Três taxonomias independentes
- **Descrição:** `expense_types` (Despesas Fixas), `avista_expense_types`
  (Pagamentos à Vista/PIX) e `funcionaria_expense_types` (Funcionária) são
  tabelas separadas, cada uma com seu próprio CRUD (`/api/expense-types`,
  `/api/avista-expense-types`, `/api/funcionaria-expense-types`).
- **Objetivo:** evitar que a lista de categorias de uma seção se misture com
  a de outra sem relação nenhuma entre si.
- **Comportamento esperado:** criar/renomear/excluir um tipo em uma seção não
  afeta as demais; nomes podem se repetir entre taxonomias diferentes (o
  `UNIQUE` em `name` é por tabela).
- **Exceções:** nenhuma — este é o modelo definitivo (ver ADR-004 em
  [DECISIONS.md](DECISIONS.md); já existiu uma versão compartilhada,
  descontinuada na migration 0009).
- **Impacto:** três conjuntos de rotas quase idênticas no worker
  (duplicação de código aceita em troca do isolamento — ver
  [CONVENTIONS.md](CONVENTIONS.md)).

### RN-05 — Nome de tipo é único (por taxonomia) e não pode ser vazio
- **Descrição:** `POST`/`PUT` de qualquer tipo de despesa valida
  `name` não-vazio (após `trim()`) e retorna `409` se já existir outro tipo
  com o mesmo nome na mesma tabela.
- **Objetivo:** evitar categorias duplicadas/ambíguas nos formulários.
- **Comportamento esperado:** `422` se vazio, `409` se duplicado.
- **Exceções:** nenhuma.
- **Impacto:** validado na API (não há `UNIQUE` case-insensitive — dois nomes
  com capitalização diferente são considerados distintos).

### RN-06 — Tipo em uso não pode ser excluído
- **Descrição:** `DELETE` de um tipo de despesa é bloqueado (`409`) se
  existir ao menos um lançamento associado na tabela de pagamentos
  correspondente.
- **Objetivo:** preservar a integridade referencial e o histórico — nunca
  deixar um lançamento "órfão" sem categoria.
- **Comportamento esperado:** a API verifica `COUNT(*)` antes do `DELETE`;
  o `ON DELETE RESTRICT` na FK é a segunda camada de proteção.
- **Exceções:** nenhuma.
- **Impacto:** usuário precisa reatribuir/excluir os lançamentos antes de
  remover o tipo.

## Despesas Fixas

### RN-07 — Lançamento em lote por vários meses
- **Descrição:** `POST /api/fixed-expenses` recebe `months: number[]` e cria
  uma linha por mês, todas com o mesmo `value`/`description` e um `batch_id`
  compartilhado (`crypto.randomUUID()`).
- **Objetivo:** permitir cadastrar uma despesa recorrente (ex.: aluguel de
  Jan a Dez) em uma única operação.
- **Comportamento esperado:** a API verifica conflito mês a mês **antes** de
  inserir qualquer linha; se algum mês já tiver lançamento para o mesmo tipo,
  retorna `409` com a lista de meses em conflito e **não insere nada**.
- **Exceções:** meses podem ser não-consecutivos (`[1,3,5]` é válido);
  duplicatas na lista são deduplicadas (`[...new Set(...)]`).
- **Impacto:** `UNIQUE (expense_type_id, year, month)` no banco é a garantia
  final contra duplicidade.

### RN-08 — Descrição é opcional
- **Descrição:** `description` pode ser omitida ou vazia em Despesas Fixas e
  Pagamentos à Vista/PIX.
- **Objetivo:** flexibilidade — nem toda despesa precisa de detalhamento.
- **Comportamento esperado:** `null` quando não informada.
- **Exceções:** `funcionaria_pagamentos` **não tem** coluna `description`
  (removida na migration 0010, a pedido do usuário).
- **Impacto:** o modal de edição (`editRecordModal`) tem lógica de campos
  variável por tipo de tabela (ver `buildEditSpec` em `js/app.js`).

## Pagamentos à Vista / PIX

### RN-09 — Mesmo conceito de Despesas Fixas, taxonomia independente
- **Descrição:** `avista_payments` segue exatamente o mesmo padrão de
  `fixed_expenses` (lote por mês, `batch_id`, conflito 409), mas com
  `avista_expense_types` como taxonomia própria (não usa `expense_types`).
- **Objetivo:** separar despesas recorrentes fixas de pagamentos pontuais à
  vista/PIX, mantendo a mesma UX de lançamento em lote.
- **Comportamento esperado:** idêntico a RN-07, trocando a tabela de tipos.
- **Exceções:** nenhuma.
- **Impacto:** nenhum, exceto a duplicação de código entre
  `worker/src/routes/fixedExpenses.js` e `avistaPayments.js`.

## Funcionária — Pagamento Mensal

### RN-10 — Cálculo de Vale-Transporte é só um autofill do frontend
- **Descrição:** `calcularValeTransporte({ diasUteis, valorPassagemDia })`
  (em `services/financeiroService.js`) calcula
  `valor_vt = dias_uteis × valor_passagem_dia` (Lei 7.418/1985 — o valor da
  passagem já é considerado ida+volta) e preenche automaticamente o campo
  "Valor a Pagar" quando os campos "Dias úteis" ou "Valor passagem/dia"
  mudam.
- **Objetivo:** dar um ponto de partida rápido para o valor mais comum, sem
  impedir ajustes manuais (ex.: descontos, valores acordados diferentes).
- **Comportamento esperado:** o usuário pode editar `valor_pagar` livremente
  depois do autofill; **o servidor nunca recalcula** — grava exatamente o
  `valor_pagar` recebido no `POST`/`PUT`.
- **Exceções:** se `dias_uteis`/`valor_passagem_dia` não forem informados,
  assume `0` (não bloqueia o lançamento).
- **Impacto:** a lógica de cálculo mora **só** no frontend; qualquer alteração
  na fórmula não afeta lançamentos já salvos nem exige mudança na API.

### RN-11 — Lançamento em lote, taxonomia própria
- **Descrição:** mesmo padrão de RN-07/RN-09 (`months[]`, `batch_id`,
  conflito 409), com `funcionaria_expense_types` como taxonomia própria.
- **Objetivo:** mesma UX das demais seções de lançamento em lote.
- **Comportamento esperado:** idêntico a RN-07.
- **Exceções:** campos extras (`dias_uteis`, `valor_passagem_dia`) são
  opcionais no `POST`, com `default 0` se omitidos.
- **Impacto:** nenhum adicional.

## Regras transversais (valem para todas as seções)

### RN-12 — Nenhum valor pode ser negativo
- **Descrição:** todo campo monetário/numérico (`value`, `valor_pagar`,
  `dias_uteis`, `valor_passagem_dia`) é validado como `>= 0`.
- **Objetivo:** impedir lançamentos financeiros inconsistentes.
- **Comportamento esperado:** validado em **3 camadas**: banco (`CHECK`), API
  (`assertNonNegativeNumber`), frontend (`validatePositiveNumber`).
- **Exceções:** nenhuma.
- **Impacto:** regra listada como inquebrável em [CLAUDE.md](../CLAUDE.md).

### RN-13 — Confirmação antes de gravar
- **Descrição:** todo lançamento (criação/atualização) passa por
  `confirmModal` (ou `editRecordModal`, no caso de edição pela tela de
  consulta), mostrando um resumo dos dados antes de chamar a API.
- **Objetivo:** evitar lançamentos acidentais.
- **Comportamento esperado:** usuário pode cancelar sem efeito colateral.
- **Exceções:** exclusão pela tela de consulta usa `confirm()` nativo do
  navegador em vez do modal Bootstrap (`handleDeleteQueryRecord` em
  `js/app.js`) — inconsistência menor, ver
  [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
- **Impacto:** nenhuma escrita ocorre sem interação explícita do usuário.

### RN-14 — Auditoria automática de lançamentos
- **Descrição:** `credit_cards`, `fixed_expenses`, `avista_payments` e
  `funcionaria_pagamentos` alimentam `audit_log` via triggers SQL
  (`AFTER INSERT/UPDATE/DELETE`), sem intervenção da aplicação.
- **Objetivo:** manter um histórico de alterações consultável diretamente no
  banco, sem acoplar essa responsabilidade ao código da API.
- **Comportamento esperado:** toda escrita nessas 4 tabelas gera
  automaticamente uma linha em `audit_log` com `old_value`/`new_value` (JSON).
- **Exceções:** as tabelas de taxonomia (`expense_types` e equivalentes)
  **não** são auditadas; não há endpoint de API para consultar `audit_log`
  (só via `wrangler d1 execute`).
- **Impacto:** ver [DATABASE.md](DATABASE.md) §3 para a lista exata de
  triggers.

### RN-15 — Consulta e edição centralizadas
- **Descrição:** a seção "Consultar e Editar Lançamentos" (`index.html`)
  agrega os 4 tipos de lançamento (Cartões, Despesas Fixas, Pagamentos à
  Vista/PIX, Funcionária) em uma única tabela, com filtros por tipo/ano/mês.
- **Objetivo:** um único lugar para revisar, editar ou excluir qualquer
  lançamento, sem precisar rolar até a seção de origem.
- **Comportamento esperado:** edição abre `editRecordModal` com campos
  específicos por tipo de tabela (`buildEditSpec`); exclusão pede confirmação
  e atualiza a lista imediatamente.
- **Exceções:** não há edição de `expense_type_id` de um lançamento existente
  (só dos campos de valor/descrição/dias) — trocar a categoria exige excluir
  e recriar o lançamento.
- **Impacto:** nenhum.

## Dashboard — previsão

### RN-16 — Previsão do próximo mês é sempre relativa à data atual
- **Descrição:** `cards_total_next_month` e `other_expenses_total_next_month`
  (`GET /api/dashboard`) somam os lançamentos do mês **seguinte ao mês
  corrente do servidor** (`nextMonthRef()` em `worker/src/routes/dashboard.js`),
  independentemente do `year` passado como filtro para o gráfico.
- **Objetivo:** o card de previsão sempre mostra "quanto vou gastar mês que
  vem", não um mês arbitrário escolhido pelo filtro.
- **Comportamento esperado:** `other_expenses_total_next_month` soma
  `fixed_expenses.value` + `funcionaria_pagamentos.valor_pagar` +
  `avista_payments.value` do próximo mês; `cards_total_next_month` soma só
  `credit_cards.value` (Bradesco + Nubank).
- **Exceções:** se dezembro → o próximo mês vira janeiro do ano seguinte
  (`nextMonthRef` trata o rollover de ano).
- **Impacto:** os cards do dashboard **não mudam** ao trocar o filtro de ano
  do gráfico — eles são sempre sobre o mês seguinte ao atual.

### RN-17 — `monthly_totals` separa total geral de total de cartões
- **Descrição:** cada item de `monthly_totals` (um por mês, Jan-Dez, do ano
  filtrado) traz `total` (soma de todas as fontes) e `cards_total` (só
  Bradesco+Nubank), usados respectivamente pelo gráfico "Despesas totais por
  mês" e pelo gráfico "Total Cartões por mês".
- **Objetivo:** permitir visualizar separadamente a parte do orçamento que é
  cartão de crédito.
- **Comportamento esperado:** `total = cards_total + fixed + funcionaria +
  avista` daquele mês/ano.
- **Exceções:** nenhuma.
- **Impacto:** nenhum.
