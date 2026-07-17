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

## Folha de Pagamento (Empregada Doméstica)

Ver [`PAYROLL.md`](PAYROLL.md) para a documentação completa (base legal,
ERD, fluxograma, casos de teste, estratégia de atualização anual).

### Funcionárias (identificação mínima)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/funcionarios?situacao=ativo` | Lista (filtro opcional por situação) |
| GET | `/api/funcionarios/:id` | Busca uma funcionária |
| POST | `/api/funcionarios` | Cria `{nome, cpf, nis?, data_admissao, cargo?, categoria_esocial?, dependentes_irrf?}`. 409 se CPF já existir |
| PUT | `/api/funcionarios/:id` | Atualiza dados cadastrais / situação (`ativo`\|`afastado`\|`desligado`) |
| DELETE | `/api/funcionarios/:id` | Remove (bloqueado se houver folhas vinculadas) |

### Rubricas (Tabela de Rubricas — conceito S-1010)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/rubricas?ativo=true` | Lista (filtro opcional) |
| POST | `/api/rubricas` | Cria `{codigo, descricao, natureza_esocial, tipo, incidencia_inss?, incidencia_irrf?, incidencia_fgts?}` |
| PUT | `/api/rubricas/:id` | Atualiza descrição/incidências/ativo |

### Parâmetros Legais

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/parametros-legais` | Lista todas as versões, mais recente primeiro |
| GET | `/api/parametros-legais/vigentes?competencia=2026-07-01` | Retorna a versão vigente para a competência |
| POST | `/api/parametros-legais` | Cria uma nova versão (ver `PAYROLL.md`, seção "Atualização anual") |

### Folha de Pagamento

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/folha?funcionaria_id=1&year=2026` | Lista folhas (filtros opcionais) |
| GET | `/api/folha/:id` | Detalhe completo (+ rubricas + lançamentos financeiros) |
| POST | `/api/folha` | Processa uma nova folha `{funcionaria_id, competencia, salario_base, dias_uteis, valor_passagem_dia, horas_extras?, adicional_noturno?, insalubridade?, periculosidade?, comissoes?, outras_verbas?, descontos?, percentual_desconto_vt?}`. Cria com `status: "aberta"` |
| POST | `/api/folha/:id/fechar` | Fecha a folha (imutável a partir daqui) e registra os 3 lançamentos financeiros |
| DELETE | `/api/folha/:id` | Remove (somente se `status: "aberta"`; 409 se já fechada) |

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
