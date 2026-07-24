# Roadmap

> Itens de "Futuro" são sugestões de baixa prioridade derivadas da análise do
> código (dívidas técnicas, lacunas), não compromissos assumidos. Nenhum item
> aqui deve ser implementado sem confirmação do usuário — em especial, **não
> reintroduzir o módulo de Folha de Pagamento** (ver [DECISIONS.md](DECISIONS.md) ADR-003).

## Concluído

| Item | Status |
|---|---|
| Cadastro de faturas de Cartão de Crédito (Bradesco/Nubank) com fluxo de conflito (Atualizar/Manter) | ✅ Concluído |
| Despesas Fixas com tipos dinâmicos e lançamento em lote por vários meses | ✅ Concluído |
| Pagamentos à Vista/PIX (mesmo conceito de Despesas Fixas, taxonomia própria) | ✅ Concluído |
| Funcionária — Pagamento Mensal com cálculo de Vale-Transporte (Lei 7.418/1985) | ✅ Concluído |
| Módulo completo de Folha de Pagamento (INSS/IRRF/FGTS/eSocial) | ✅ Implementado e depois **removido** deliberadamente (ver ADR-003) |
| Seção "Consultar e Editar Lançamentos" com filtros e ações de editar/excluir | ✅ Concluído |
| Modal de confirmação antes de todo lançamento | ✅ Concluído |
| Dashboard: 2 cards de previsão (próximo mês) | ✅ Concluído |
| Dashboard: 2 gráficos de barra Jan-Dez (total geral e só cartões) via Chart.js | ✅ Concluído |
| Dashboard: alternância gráfico/tabela, filtro por ano, timestamp de última atualização | ✅ Concluído |
| Auditoria automática via triggers SQL (`audit_log`) para as 4 tabelas de lançamento | ✅ Concluído |
| Validação em 3 camadas (banco/API/frontend) para valores não-negativos | ✅ Concluído |
| Autenticação por API Key (Bearer) + CORS restrito a `ALLOWED_ORIGIN` | ✅ Concluído |
| Deploy: GitHub Pages (frontend) + Cloudflare Workers/D1 (backend) | ✅ Concluído |
| Documentação técnica consolidada em `docs/` (esta reorganização) | ✅ Concluído — 2026-07-23 |

## Em desenvolvimento

Nenhum item em desenvolvimento identificado no momento desta auditoria — o
sistema está funcionalmente completo para o escopo atual (previsão de
despesas pessoais domésticas).

| Item | Status |
|---|---|
| `ACTION_ROUTES` em `worker/src/index.js` — scaffolding vazio para futuras rotas `POST /recurso/:id/acao` | 🟡 Preparado, sem uso ainda |

## Futuro (sugestões, não compromissos)

| Item | Motivação | Status |
|---|---|---|
| Paginação nas listagens (`GET /api/fixed-expenses`, etc.) | Hoje retorna tudo sem limite; aceitável no volume atual, mas cresce sem controle | 💤 Não iniciado |
| Endpoint de consulta do `audit_log` | Hoje só é consultável via `wrangler d1 execute`; um endpoint somente-leitura poderia expor o histórico na UI | 💤 Não iniciado |
| Testes automatizados (unitário para `services/financeiroService.js` e `worker/src/routes/`) | Hoje a validação é 100% manual/E2E (ver README, checklist original) | 💤 Não iniciado |
| Pipeline de CI/CD (lint, testes, deploy automático) | Hoje o deploy é manual (`git push` + `wrangler deploy`) | 💤 Não iniciado |
| Auditoria também das tabelas de taxonomia (`expense_types` e equivalentes) | Renomear/excluir um tipo hoje não fica registrado em `audit_log` | 💤 Não iniciado |
| Atualização do Wrangler (`^3.90.0` → v4) | Cloudflare já lançou uma major nova; avaliar breaking changes antes de migrar | 💤 Não iniciado |
| Padronizar todos os `confirm()` nativos para o modal Bootstrap (`confirmModal`) | Hoje a exclusão pela tela de consulta usa `window.confirm()`, inconsistente com o resto da UI | 💤 Não iniciado |

**Explicitamente fora de escopo** (removido uma vez, não reconsiderar sem
pedido novo e explícito do usuário):
- Módulo de Folha de Pagamento com motor de cálculo de INSS/IRRF/FGTS/eSocial
  (tabelas `funcionarios`, `rubricas`, `parametros_legais`, `folha_*`).
