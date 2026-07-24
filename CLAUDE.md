# CLAUDE.md — Contexto rápido do projeto

> Leia este arquivo primeiro em toda nova sessão. Ele é intencionalmente curto.
> Para o estado atual e os próximos passos, veja **docs/SESSION_SUMMARY.md** em seguida.

## Visão geral

**CloudFinance ("Financeiro")** é um sistema pessoal de **previsão** de despesas —
o foco é estimar quanto será gasto no próximo mês, não apenas registrar o que já
foi gasto. Uso doméstico, single-user (uma pessoa, um projeto, uma API Key fixa).

## Objetivo do sistema

Permitir o cadastro de lançamentos financeiros recorrentes (faturas de cartão,
despesas fixas, pagamentos à vista/PIX, pagamento mensal de funcionária) e
exibir, em um dashboard, o total previsto para o **próximo mês** e a evolução
mensal (Jan-Dez) do ano selecionado.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript ES6 (módulos nativos, **sem bundler**) + Bootstrap 5 + Chart.js |
| Hospedagem frontend | GitHub Pages (estático) |
| Backend | Cloudflare Workers — API REST em JavaScript puro, **sem framework** |
| Banco | Cloudflare D1 (SQLite) |
| Autenticação | API Key fixa (Bearer token), única para todo o sistema |

## Arquitetura resumida

```
Navegador (index.html / dashboard.html)
   │  fetch + Authorization: Bearer <API_KEY>
   ▼
Cloudflare Worker (worker/src/index.js — router manual)
   │  env.DB (binding D1)
   ▼
Cloudflare D1 (SQLite) — worker/migrations/*.sql
```

Detalhes completos, diagramas e responsabilidades de cada módulo: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Ordem de leitura recomendada

1. `CLAUDE.md` (este arquivo)
2. [docs/SESSION_SUMMARY.md](docs/SESSION_SUMMARY.md) — estado atual, leitura **obrigatória**
3. [docs/ROADMAP.md](docs/ROADMAP.md)
4. [docs/DECISIONS.md](docs/DECISIONS.md)
5. Conforme a tarefa: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md), [docs/API_REFERENCE.md](docs/API_REFERENCE.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/CONVENTIONS.md](docs/CONVENTIONS.md), [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md), [docs/DEPLOY.md](docs/DEPLOY.md)

Índice completo com descrição de cada arquivo: [docs/INDEX.md](docs/INDEX.md).

## Regras que NUNCA devem ser quebradas

1. **Nenhum valor monetário pode ser negativo.** Validar nas 3 camadas: banco
   (`CHECK (value >= 0)`), API (`assertNonNegativeNumber`), frontend
   (`validatePositiveNumber`).
2. **Cada seção de lançamento em lote tem sua própria taxonomia de tipos de
   despesa.** `expense_types` (Despesas Fixas), `avista_expense_types`
   (Pagamentos à Vista/PIX) e `funcionaria_expense_types` (Funcionária) **nunca**
   devem ser compartilhadas ou misturadas entre si.
3. **`updated_at` é sempre setado explicitamente pela aplicação** em cada
   UPDATE (`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` no próprio SQL de update).
   Nunca criar um trigger "auto-touch" — já foi tentado e causou duplicação no
   `audit_log` (ver `worker/migrations/0001_init.sql`, comentário, e
   [docs/DECISIONS.md](docs/DECISIONS.md) ADR-005).
4. **Nunca editar uma migration já aplicada em produção.** Toda mudança de
   schema é uma **nova** migration em `worker/migrations/00XX_*.sql`.
5. **O servidor nunca recalcula/sobrescreve `valor_pagar`** (Funcionária). O
   cálculo de Vale-Transporte (`calcularValeTransporte` em
   `services/financeiroService.js`) é só um autofill de conveniência no
   frontend; o backend persiste exatamente o valor recebido.
6. **Toda rota exige `Authorization: Bearer <API_KEY>`** e respeita
   `ALLOWED_ORIGIN` (CORS). Nunca remover ou enfraquecer essa checagem em
   `worker/src/index.js`.
7. **Não reintroduzir o módulo completo de Folha de Pagamento** (tabelas
   `funcionarios`, `rubricas`, `parametros_legais`, `folha_*`, cálculo de
   INSS/IRRF/FGTS/eSocial). Foi implementado e **removido deliberadamente**
   a pedido do usuário (ver [docs/DECISIONS.md](docs/DECISIONS.md) ADR-003).
   Só reconsiderar mediante pedido explícito e novo do usuário.
8. **Zero dependências de runtime além do Wrangler** (devDependency do
   worker). Sem framework/bundler no frontend, sem framework HTTP no worker.

## Checklist obrigatório antes de implementar qualquer alteração

- [ ] Li `docs/SESSION_SUMMARY.md` e `docs/DECISIONS.md` — a mudança conflita
      com alguma decisão já tomada (ex.: reintroduzir algo já removido)?
- [ ] Consultei `docs/BUSINESS_RULES.md` — a regra já existe ou estou mudando
      uma regra existente (nesse caso, atualizar o documento)?
- [ ] Se mexer no banco: nova migration em `worker/migrations/` (nunca alterar
      uma existente); atualizar `docs/DATABASE.md` (schema + diagrama ER).
- [ ] Se mexer na API: atualizar `docs/API_REFERENCE.md` (fonte única —
      `worker/API.md` só aponta para lá).
- [ ] Validação em 3 camadas (banco/API/frontend) para todo campo numérico novo.
- [ ] Testei localmente: `wrangler dev` + D1 local + frontend
      (`python3 -m http.server`) — ver `docs/DEPLOY.md`.
- [ ] Atualizei `docs/CHANGELOG.md` e `docs/SESSION_SUMMARY.md` ao concluir.

## Fluxo recomendado de desenvolvimento

1. Backend local: `cd worker && npx wrangler d1 migrations apply financeiro-db --local && npx wrangler dev`
2. Frontend local: `python3 -m http.server 8080` (raiz do projeto), apontando
   temporariamente `js/api.js` para `http://localhost:8787` e a API Key de
   `worker/.dev.vars`.
3. Implementar seguindo os padrões de `docs/CONVENTIONS.md`.
4. Testar ponta a ponta no navegador (golden path + casos de conflito/erro).
5. Reverter `js/api.js` para os valores de produção antes de publicar.
6. Deploy: ver `docs/DEPLOY.md`.

## Como iniciar uma nova sessão

Prompt sugerido (ver também [docs/INDEX.md](docs/INDEX.md)):

> Leia `CLAUDE.md`, `docs/SESSION_SUMMARY.md`, `docs/ROADMAP.md` e
> `docs/DECISIONS.md`. Depois analise o código relevante antes de implementar
> qualquer alteração.
