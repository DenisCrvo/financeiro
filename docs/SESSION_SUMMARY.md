# Resumo da Sessão (leitura obrigatória)

> Documento curto (máx. 2 páginas), atualizado ao final de cada sessão
> relevante. Se você é uma nova sessão do Claude Code: leia isto depois de
> [CLAUDE.md](../CLAUDE.md) e antes de qualquer implementação.

**Última atualização:** 2026-07-23

## Estado atual do projeto

Sistema **funcionalmente completo** para seu escopo atual: previsão de
despesas pessoais domésticas, uso single-user. Frontend estático (GitHub
Pages) + API em Cloudflare Workers + banco Cloudflare D1. Sem build step, sem
testes automatizados, deploy manual.

Não é um repositório Git (`git status` confirma: "not a git repository").
Não há histórico de commits para consultar — este `docs/` e o `CLAUDE.md` são
a única fonte de contexto persistente do projeto.

## Funcionalidades prontas

- **Cartões de Crédito** (Bradesco/Nubank) — lançamento por ano/mês, conflito
  resolvido via `check` + escolha Atualizar/Manter.
- **Despesas Fixas** — tipos dinâmicos (`expense_types`), lançamento em lote
  por vários meses.
- **Pagamentos à Vista/PIX** — mesmo conceito de Despesas Fixas, taxonomia
  própria (`avista_expense_types`).
- **Funcionária — Pagamento Mensal** — lançamento de valor livre
  (`valor_pagar`), com autofill de Vale-Transporte (Lei 7.418/1985), taxonomia
  própria (`funcionaria_expense_types`).
- **Consultar e Editar Lançamentos** — filtro por tipo/ano/mês, edição e
  exclusão unificadas das 4 tabelas de lançamento.
- **Dashboard** — 2 cards de previsão do próximo mês (Cartões / Outras
  Despesas), 2 gráficos de barra Jan-Dez (total geral e só cartões),
  alternância gráfico/tabela, timestamp de última atualização.
- **Auditoria automática** — `audit_log` via triggers SQL nas 4 tabelas de
  lançamento (não nas taxonomias de tipo).
- **Segurança básica** — API Key (Bearer) obrigatória em toda rota + CORS
  restrito a `ALLOWED_ORIGIN`.

Detalhe completo de cada regra: [BUSINESS_RULES.md](BUSINESS_RULES.md).
Checklist original de validação (E2E manual): ver `README.md` (histórico,
seção "Regras de negócio implementadas" antes desta reorganização — o
checklist como tal foi incorporado a este resumo e a [ROADMAP.md](ROADMAP.md)).

## Últimas implementações relevantes (ordem cronológica)

1. **2026-07-17** — Módulo completo de Folha de Pagamento (eSocial Doméstico)
   implementado **e removido** no mesmo dia, a pedido do usuário. Ver
   [DECISIONS.md](DECISIONS.md) ADR-003 — **não reintroduzir sem pedido
   explícito**.
2. **2026-07-17 a 2026-07-20** — Seção "Funcionária — Pagamento Mensal"
   recriada de forma simples (só VT), com taxonomia própria e valor
   editável.
3. **2026-07-21** — Seção "Pagamentos à Vista / PIX" adicionada (última
   funcionalidade nova antes desta reorganização de documentação).
4. **2026-07-23** — Esta sessão: auditoria completa do projeto e criação de
   toda a documentação técnica em `docs/` + `CLAUDE.md`, com o objetivo de
   tornar sessões futuras independentes do histórico de conversa.

## Próximos passos recomendados

Nenhum pedido de funcionalidade nova estava em aberto ao final desta sessão.
Sugestões de baixa prioridade (ver [ROADMAP.md](ROADMAP.md) para a lista
completa e [KNOWN_ISSUES.md](KNOWN_ISSUES.md) para o detalhe técnico):

1. Se o usuário pedir uma nova funcionalidade: seguir o checklist de
   [CLAUDE.md](../CLAUDE.md) antes de implementar (ler `SESSION_SUMMARY.md`,
   `DECISIONS.md`, `BUSINESS_RULES.md`).
2. Se o pedido envolver "folha de pagamento" ou "encargos da funcionária":
   **parar e confirmar com o usuário** — já foi removido deliberadamente
   uma vez (ADR-003).
3. Dívidas técnicas de baixo risco, caso o usuário peça "limpeza"/"melhorias"
   sem especificar o quê: ver a tabela "Futuro" em
   [ROADMAP.md](ROADMAP.md) (paginação, testes automatizados, CI/CD,
   auditoria das taxonomias, padronizar `confirm()` nativo para modal).

## Onde continuar lendo

- Arquitetura e diagramas: [ARCHITECTURE.md](ARCHITECTURE.md)
- Regras de negócio: [BUSINESS_RULES.md](BUSINESS_RULES.md)
- API: [API_REFERENCE.md](API_REFERENCE.md)
- Banco de dados: [DATABASE.md](DATABASE.md)
- Convenções de código: [CONVENTIONS.md](CONVENTIONS.md)
- Problemas conhecidos: [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
- Deploy: [DEPLOY.md](DEPLOY.md)
- Índice completo: [INDEX.md](INDEX.md)
