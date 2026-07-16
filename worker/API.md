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
| POST | `/api/credit-cards` | Cria fatura `{card_name, year, month, value}`. Retorna 409 se já existir |
| PUT | `/api/credit-cards/:id` | Atualiza valor `{value}` (move valor atual para `previous_value`) |
| DELETE | `/api/credit-cards/:id` | Remove lançamento |

## Funcionária (mensal)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/employee?year=2026` | Lista lançamentos mensais |
| GET | `/api/employee/check?year=2026&month=7` | Verifica se já existe lançamento no mês |
| POST | `/api/employee` | Cria lançamento `{year, month, days_worked, daily_transport_value, transport_value, vacation_value?, thirteenth_value?, advance_discount_value?, advance_discount_months?, esocial_value?}` |
| PUT | `/api/employee/:id` | Atualiza campos (parcial) |
| DELETE | `/api/employee/:id` | Remove lançamento |

## Adiantamentos

Cronograma de desconto de adiantamento (empréstimo) à funcionária — mesmo
formato de lançamento em lote de Despesas Fixas (ano + meses). **Uso
exclusivo para controle de desconto em folha/e-social: estes valores nunca
entram nos totais do Dashboard.**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/advances?year=2026` | Lista parcelas agendadas (filtro por ano) |
| GET | `/api/advances/summary?year=2026` | `{total_borrowed, total_discounted, total_remaining}` — descontado = parcelas com mês/ano já alcançado; restante = parcelas futuras |
| POST | `/api/advances` | Cria em lote `{value, year, months: [7,8,9]}` — uma parcela por mês, mesmo valor em cada |
| PUT | `/api/advances/:id` | Atualiza `{discount_value}` de uma parcela |
| DELETE | `/api/advances/:id` | Remove uma parcela do cronograma |

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
| POST | `/api/fixed-expenses` | Cria em lote `{expense_type_id, year, months: [1,2,3], value, description?}` — uma linha por mês |
| PUT | `/api/fixed-expenses/:id` | Atualiza `{value, description?}` |
| DELETE | `/api/fixed-expenses/:id` | Remove lançamento |

## Dashboard

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard?year=2026` | Cards e totais mensais (Jan-Dez) para o gráfico |
| GET | `/api/dashboard/last-update` | Timestamp do último registro alterado no banco |

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
