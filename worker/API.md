# API — financeiro-api (Cloudflare Workers)

Base URL (produção): `https://financeiro-api.<seu-subdomínio>.workers.dev`

Todas as rotas exigem o header:
```
Authorization: Bearer <API_KEY>
```
Requisições sem token válido recebem `401 Não autorizado`.

## Cartões de Crédito

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/credit-cards?year=2026` | Lista faturas (filtro opcional por ano) |
| GET | `/api/credit-cards/check?card_name=nubank&year=2026&month=7` | Verifica se já existe lançamento no mês |
| GET | `/api/credit-cards/:id` | Busca uma fatura específica |
| POST | `/api/credit-cards` | Cria fatura `{card_name, year, month, value}`. Retorna 409 se já existir |
| PUT | `/api/credit-cards/:id` | Atualiza valor `{value}` (move valor atual para `previous_value`) |
| DELETE | `/api/credit-cards/:id` | Remove lançamento |

## Tipos de Despesa

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/expense-types` | Lista tipos cadastrados |
| POST | `/api/expense-types` | Cria `{name, icon?}`. Retorna 409 se já existir |
| PUT | `/api/expense-types/:id` | Renomeia `{name, icon?}`. Retorna 409 se o novo nome já existir em outro tipo |
| DELETE | `/api/expense-types/:id` | Remove (bloqueado se houver despesas fixas associadas) |

## Despesas Fixas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/fixed-expenses?year=2026` | Lista lançamentos (com nome/ícone do tipo) |
| GET | `/api/fixed-expenses/:id` | Busca um lançamento específico (com nome/ícone do tipo) |
| POST | `/api/fixed-expenses` | Cria em lote `{expense_type_id, year, months: [1,2,3], value, description?}` — uma linha por mês |
| PUT | `/api/fixed-expenses/:id` | Atualiza `{value, description?}` |
| DELETE | `/api/fixed-expenses/:id` | Remove lançamento |

## Funcionária — Pagamento Mensal

Pagamento mensal com valor de lançamento livre (`valor_pagar`) — sem
cadastro de RH nem cálculo de tributos/encargos. O cálculo de
Vale-Transporte (Lei 7.418/1985: `dias_uteis × valor_passagem_dia`) é
apenas um preenchimento automático no frontend; o servidor grava
exatamente o `valor_pagar` recebido, sem recalcular ou sobrescrever.

### Tipos de Despesa da Funcionária

Taxonomia própria (`funcionaria_expense_types`), **independente** de
`expense_types` (usado por Despesas Fixas) — as duas listas não se
misturam.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/funcionaria-expense-types` | Lista tipos cadastrados |
| POST | `/api/funcionaria-expense-types` | Cria `{name, icon?}`. Retorna 409 se já existir |
| PUT | `/api/funcionaria-expense-types/:id` | Renomeia `{name, icon?}`. Retorna 409 se o novo nome já existir em outro tipo |
| DELETE | `/api/funcionaria-expense-types/:id` | Remove (bloqueado se houver pagamentos associados) |

### Pagamentos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/funcionaria-payments?year=2026` | Lista pagamentos (com nome/ícone do tipo; filtro opcional por ano) |
| GET | `/api/funcionaria-payments/:id` | Busca um pagamento específico (com nome/ícone do tipo) |
| POST | `/api/funcionaria-payments` | Cria em lote `{expense_type_id, year, months: [1,2,3], valor_pagar, dias_uteis?, valor_passagem_dia?}` — uma linha por mês. 409 se já existir pagamento deste tipo no mês |
| PUT | `/api/funcionaria-payments/:id` | Atualiza `{valor_pagar?, dias_uteis?, valor_passagem_dia?}` |
| DELETE | `/api/funcionaria-payments/:id` | Remove lançamento |

## Dashboard

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard?year=2026` | Cards e totais mensais (Jan-Dez) para o gráfico — cada item de `monthly_totals` inclui `total` (geral) e `cards_total` (só Bradesco+Nubank) |
| GET | `/api/dashboard/last-update` | Timestamp do último registro alterado no banco |

> **Histórico de alterações:** a tabela `audit_log` continua sendo alimentada
> automaticamente por triggers a cada INSERT/UPDATE/DELETE em `credit_cards` e
> `fixed_expenses`, mas não há endpoint de API para consultá-la — é uma tabela
> de auditoria interna do banco (pode ser consultada via `wrangler d1 execute`
> se necessário).

### Exemplo de resposta — `GET /api/dashboard?year=2026`
```json
{
  "year": 2026,
  "next_month": { "year": 2026, "month": 8, "month_name": "Agosto" },
  "cards_total_next_month": 8500.33,
  "other_expenses_total_next_month": 3200.00,
  "monthly_totals": [
    { "month": 1, "month_name": "Janeiro", "total": 9800.50 },
    { "month": 2, "month_name": "Fevereiro", "total": 9100.10 }
  ]
}
```

## Códigos de erro
- `400` — corpo da requisição inválido
- `401` — não autorizado (API Key ausente/incorreta)
- `404` — rota ou registro não encontrado
- `409` — conflito (registro já existente / dependência)
- `422` — validação de campo falhou
- `500` — erro interno
