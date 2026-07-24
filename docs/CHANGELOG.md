# Changelog

> Agrupado por funcionalidade entregue, não por commit (o projeto não é um
> repositório Git — não há histórico de commits a espelhar). Datas derivadas
> das migrations correspondentes em `worker/migrations/`.

## 2026-07-15 — Núcleo inicial

- Estrutura completa: frontend estático (cadastro + dashboard) + API em
  Cloudflare Workers + banco D1.
- **Cartões de Crédito** (Bradesco/Nubank): lançamento por ano/mês, fluxo de
  conflito (atualizar valor / manter lançamento anterior).
- **Despesas Fixas**: tipos de despesa cadastráveis dinamicamente, lançamento
  em lote por vários meses.
- **Cadastro de Funcionária** (versão inicial): `employee_monthly` +
  `employee_advances` (dias trabalhados, transporte, férias, 13º, desconto de
  adiantamento, guia e-social).
- Auditoria automática via triggers SQL (`audit_log`) em todas as tabelas de
  lançamento.
- _Migration: `0001_init.sql`._

## 2026-07-16 — Remoção do cadastro antigo de Funcionária

- Removidos `employee_monthly` e `employee_advances`: os formulários
  correspondentes tinham sido removidos do frontend, então as tabelas
  deixaram de ser necessárias.
- _Migration: `0002_drop_employee_features.sql`._

## 2026-07-17 — Módulo de Folha de Pagamento: criado e removido no mesmo dia

- Implementado um módulo completo de Folha de Pagamento para Empregada
  Doméstica, com conformidade ao eSocial Doméstico: cadastro de
  funcionária (`funcionarios`), rubricas (`rubricas`), tabelas legais
  versionadas por competência (`parametros_legais` — INSS, IRRF, FGTS,
  encargos patronais, VT), motor de cálculo (`folha_pagamento`,
  `folha_rubricas`), integração financeira automática ao fechar a folha
  (`folha_lancamentos_financeiros`), e triggers de imutabilidade para folha
  fechada.
- Simplificação do cadastro de funcionária (CPF/NIS/admissão/cargo/
  dependentes passam a ser opcionais).
- Atualização dos parâmetros legais com uma nova versão (competência
  2025-01), conferida pelo usuário contra o eSocial Doméstico real.
- **Módulo removido por completo** a pedido do usuário, no mesmo dia —
  `funcionarios`, `rubricas`, `parametros_legais`, `folha_pagamento`,
  `folha_rubricas` e `folha_lancamentos_financeiros` dropadas. Ver
  [DECISIONS.md](DECISIONS.md) ADR-003 para o contexto completo.
- **Funcionária — Pagamento Mensal** recriada, agora simples: sem cadastro de
  RH, apenas o lançamento do Vale-Transporte (`dias_uteis ×
  valor_passagem_dia`), no mesmo formato de lançamento em lote de Despesas
  Fixas.
- Ajuste do modelo: o campo de categorização de Funcionária passou a usar
  `expense_type_id` (inicialmente compartilhando a tabela `expense_types` de
  Despesas Fixas), depois migrado para uma taxonomia própria
  (`funcionaria_expense_types`), para que as duas listas não se misturassem.
- _Migrations: `0003_payroll_module.sql`, `0004_simplify_funcionarios.sql`,
  `0005_update_legal_parameters.sql`, `0006_remove_payroll_module.sql`,
  `0007_add_funcionaria_payments.sql`,
  `0008_funcionaria_payments_use_expense_type.sql`,
  `0009_funcionaria_own_expense_types.sql`._

## 2026-07-20 — Funcionária: valor editável

- O campo antes fixo (`valor_vt`, só o resultado do cálculo de VT) foi
  renomeado para `valor_pagar` e passou a ser **editável** pelo usuário — o
  cálculo de VT agora só preenche automaticamente o valor inicial, podendo
  ser ajustado antes de salvar (mesmo padrão do campo "Valor" de Despesas
  Fixas).
- Coluna `description` removida de `funcionaria_pagamentos`, a pedido do
  usuário.
- _Migration: `0010_funcionaria_editable_value.sql`._

## 2026-07-21 — Pagamentos à Vista / PIX

- Nova seção de lançamento: **Pagamentos à Vista / PIX**, com o mesmo
  conceito de Despesas Fixas (lançamento em lote por vários meses,
  categorizado por tipo), mas com taxonomia de tipos própria desde o início
  (`avista_expense_types`, independente de `expense_types` e de
  `funcionaria_expense_types`).
- Dashboard atualizado para incluir Pagamentos à Vista/PIX nos totais de
  "Outras Despesas" (previsão do próximo mês e totais mensais).
- _Migration: `0011_add_avista_payments.sql`._

## 2026-07-23 — Reorganização da documentação técnica

- Todo o conhecimento do projeto (arquitetura, regras de negócio, API, banco,
  decisões, convenções) consolidado em `docs/` + `CLAUDE.md`, reduzindo a
  dependência do histórico de conversas para dar contexto a novas sessões.
- `README.md` revisado para focar em humanos (instalação/execução/deploy),
  sem duplicar o conteúdo técnico de `docs/`.
- `worker/API.md` passou a apontar para `docs/API_REFERENCE.md` (fonte
  única), evitando duas versões da mesma documentação.
