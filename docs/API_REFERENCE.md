# Referência da API

> Fonte única da documentação da API. `worker/API.md` aponta para este
> arquivo — não duplique conteúdo lá.

Base URL (produção): `https://cloudfinanceiro.deniscrvo.workers.dev`
(configurada em `js/api.js`, constante `API_BASE_URL`; ver
[DEPLOY.md](DEPLOY.md) para como obter a sua própria URL).

## Autenticação

Toda rota (exceto o preflight `OPTIONS`) exige o header:

```
Authorization: Bearer <API_KEY>
```

Requisição sem token ou com token incorreto recebe `401 Não autorizado.`
A chave é comparada contra o secret `API_KEY` definido via
`wrangler secret put API_KEY` (produção) ou `worker/.dev.vars` (local).

## CORS

Controlado por `ALLOWED_ORIGIN` (`worker/wrangler.toml`). Preflight
(`OPTIONS`) responde `204` com os headers de CORS antes de qualquer checagem
de autenticação.

## Formato de erro

Todo erro é um JSON `{ "error": "mensagem em pt-BR" }`, com o HTTP status
correspondente:

| Status | Significado |
|---|---|
| `400` | Corpo da requisição inválido (JSON malformado) |
| `401` | Não autorizado (API Key ausente/incorreta) |
| `404` | Rota ou registro não encontrado |
| `409` | Conflito (registro já existente / dependência em uso) |
| `422` | Validação de campo falhou (campo obrigatório ausente, tipo/valor inválido) |
| `500` | Erro interno no servidor |

Respostas de conflito (`409`) em endpoints de criação em lote incluem também
`conflicts: number[]` com os meses problemáticos; em Cartões/Tipos, incluem
`record`/nada, conforme o endpoint (ver exemplos abaixo).

---

## Cartões de Crédito

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/credit-cards?year=2026` | Lista faturas (filtro opcional por ano) |
| GET | `/api/credit-cards/check?card_name=nubank&year=2026&month=7` | Verifica se já existe lançamento no mês |
| GET | `/api/credit-cards/:id` | Busca uma fatura específica |
| POST | `/api/credit-cards` | Cria fatura |
| PUT | `/api/credit-cards/:id` | Atualiza valor (move valor atual para `previous_value`) |
| DELETE | `/api/credit-cards/:id` | Remove lançamento |

**POST /api/credit-cards** — payload:
```json
{ "card_name": "nubank", "year": 2026, "month": 7, "value": 1234.56 }
```
- `card_name`: `"bradesco"` ou `"nubank"` (obrigatório)
- `year`: inteiro 2000–2100 (obrigatório)
- `month`: inteiro 1–12 (obrigatório)
- `value`: número ≥ 0 (obrigatório)

Resposta `201` com o registro criado. `409` se já existir fatura para o mês:
```json
{ "error": "Já existe lançamento para este cartão/mês.", "record": { "...": "..." } }
```

**GET /api/credit-cards/check** — resposta:
```json
{ "exists": true, "record": { "id": 12, "value": 980.50, "...": "..." } }
```

**PUT /api/credit-cards/:id** — payload: `{ "value": 1300.00 }`. Resposta:
registro atualizado, com `previous_value` = valor anterior.

**DELETE /api/credit-cards/:id** — resposta: `{ "success": true }`.

---

## Tipos de Despesa (Despesas Fixas)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/expense-types` | Lista tipos cadastrados |
| POST | `/api/expense-types` | Cria tipo |
| PUT | `/api/expense-types/:id` | Renomeia |
| DELETE | `/api/expense-types/:id` | Remove (bloqueado se houver despesas fixas associadas) |

**POST/PUT** — payload: `{ "name": "Streaming", "icon": "bi-tv" }`
(`icon` opcional, string livre — usada como classe do Bootstrap Icons).
`409` se já existir tipo com o mesmo nome. `422` se `name` vazio.
`DELETE` retorna `409` se `fixed_expenses` tiver registros com esse tipo.

---

## Despesas Fixas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/fixed-expenses?year=2026` | Lista lançamentos (com nome/ícone do tipo) |
| GET | `/api/fixed-expenses/:id` | Busca um lançamento específico |
| POST | `/api/fixed-expenses` | Cria em lote — uma linha por mês |
| PUT | `/api/fixed-expenses/:id` | Atualiza `{ value, description? }` |
| DELETE | `/api/fixed-expenses/:id` | Remove lançamento |

**POST /api/fixed-expenses** — payload:
```json
{
  "expense_type_id": 3,
  "year": 2026,
  "months": [1, 2, 3],
  "value": 450.00,
  "description": "Plano anual"
}
```
- `months`: lista não-vazia de inteiros 1–12 (duplicatas são deduplicadas)
- `description`: opcional

Resposta `201` com a lista de registros criados (um por mês). `409` se algum
mês já tiver lançamento desse tipo:
```json
{ "error": "Já existe lançamento desta despesa nos meses: 2, 3.", "conflicts": [2, 3] }
```
Nesse caso **nenhuma linha é inserida** (nem dos meses sem conflito).

**PUT /api/fixed-expenses/:id** — payload: `{ "value": 500.00, "description": "Novo valor" }`
(`description` pode ser `null`/omitida para não alterar).

---

## Pagamentos à Vista / PIX

Mesmo conceito de Despesas Fixas (lançamento em lote por vários meses), com
taxonomia de tipos própria (`avista_expense_types`), **independente** de
`expense_types` e de `funcionaria_expense_types`.

### Tipos de Despesa à Vista/PIX

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/avista-expense-types` | Lista tipos cadastrados |
| POST | `/api/avista-expense-types` | Cria tipo |
| PUT | `/api/avista-expense-types/:id` | Renomeia |
| DELETE | `/api/avista-expense-types/:id` | Remove (bloqueado se houver pagamentos associados) |

Payloads idênticos aos de Tipos de Despesa (Despesas Fixas), acima.

### Pagamentos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/avista-payments?year=2026` | Lista lançamentos (com nome/ícone do tipo) |
| GET | `/api/avista-payments/:id` | Busca um lançamento específico |
| POST | `/api/avista-payments` | Cria em lote |
| PUT | `/api/avista-payments/:id` | Atualiza `{ value, description? }` |
| DELETE | `/api/avista-payments/:id` | Remove lançamento |

Payloads idênticos aos de Despesas Fixas, acima (mesmos campos:
`expense_type_id`, `year`, `months`, `value`, `description?`).

---

## Funcionária — Pagamento Mensal

Pagamento mensal com valor de lançamento livre (`valor_pagar`) — sem
cadastro de RH nem cálculo de tributos/encargos (esse módulo existiu e foi
removido — ver [DECISIONS.md](DECISIONS.md) ADR-003). O cálculo de
Vale-Transporte (Lei 7.418/1985: `dias_uteis × valor_passagem_dia`) é apenas
um preenchimento automático no frontend; **o servidor grava exatamente o
`valor_pagar` recebido, sem recalcular ou sobrescrever**.

### Tipos de Despesa da Funcionária

Taxonomia própria (`funcionaria_expense_types`), **independente** de
`expense_types` e de `avista_expense_types`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/funcionaria-expense-types` | Lista tipos cadastrados |
| POST | `/api/funcionaria-expense-types` | Cria tipo |
| PUT | `/api/funcionaria-expense-types/:id` | Renomeia |
| DELETE | `/api/funcionaria-expense-types/:id` | Remove (bloqueado se houver pagamentos associados) |

### Pagamentos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/funcionaria-payments?year=2026` | Lista pagamentos (filtro opcional por ano) |
| GET | `/api/funcionaria-payments/:id` | Busca um pagamento específico |
| POST | `/api/funcionaria-payments` | Cria em lote |
| PUT | `/api/funcionaria-payments/:id` | Atualiza campos |
| DELETE | `/api/funcionaria-payments/:id` | Remove lançamento |

**POST /api/funcionaria-payments** — payload:
```json
{
  "expense_type_id": 5,
  "year": 2026,
  "months": [1, 2, 3],
  "valor_pagar": 220.00,
  "dias_uteis": 22,
  "valor_passagem_dia": 10.00
}
```
- `valor_pagar`: obrigatório, número ≥ 0
- `dias_uteis`, `valor_passagem_dia`: opcionais (default `0`)
- `409` se algum mês já tiver pagamento desse tipo (mesmo formato de
  `conflicts` de Despesas Fixas)

**PUT /api/funcionaria-payments/:id** — payload (todos os campos opcionais,
mantém valor anterior se omitido):
```json
{ "valor_pagar": 250.00, "dias_uteis": 20, "valor_passagem_dia": 12.50 }
```

---

## Dashboard

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard?year=2026` | Cards e totais mensais (Jan-Dez) para o gráfico |
| GET | `/api/dashboard/last-update` | Timestamp do último registro alterado no banco |

> **Histórico de alterações:** `audit_log` é alimentado automaticamente por
> triggers a cada INSERT/UPDATE/DELETE em `credit_cards`, `fixed_expenses`,
> `avista_payments` e `funcionaria_pagamentos`, mas **não há endpoint de API**
> para consultá-la — é uma tabela de auditoria interna (consultável via
> `wrangler d1 execute`, ver [DEPLOY.md](DEPLOY.md)).

### Exemplo de resposta — `GET /api/dashboard?year=2026`
```json
{
  "year": 2026,
  "next_month": { "year": 2026, "month": 8, "month_name": "Agosto" },
  "cards_total_next_month": 8500.33,
  "other_expenses_total_next_month": 3200.00,
  "monthly_totals": [
    { "month": 1, "month_name": "Janeiro", "total": 9800.50, "cards_total": 6500.00 },
    { "month": 2, "month_name": "Fevereiro", "total": 9100.10, "cards_total": 6200.00 }
  ]
}
```
- `next_month` / `cards_total_next_month` / `other_expenses_total_next_month`
  são sempre relativos ao mês seguinte ao mês corrente do servidor,
  **independentemente** do `year` do filtro (ver RN-16 em
  [BUSINESS_RULES.md](BUSINESS_RULES.md)).
- Cada item de `monthly_totals` traz `total` (todas as fontes) e
  `cards_total` (só Bradesco+Nubank).

### Exemplo de resposta — `GET /api/dashboard/last-update`
```json
{ "last_update": "2026-07-21T00:05:12.345Z" }
```
`null` se nenhuma das 4 tabelas de lançamento tiver registros.

---

## Resumo de todos os recursos

| Recurso | Prefixo | Taxonomia própria |
|---|---|---|
| Cartões de Crédito | `/api/credit-cards` | — (`card_name` fixo) |
| Despesas Fixas | `/api/fixed-expenses` | `/api/expense-types` |
| Pagamentos à Vista/PIX | `/api/avista-payments` | `/api/avista-expense-types` |
| Funcionária | `/api/funcionaria-payments` | `/api/funcionaria-expense-types` |
| Dashboard | `/api/dashboard`, `/api/dashboard/last-update` | — |
