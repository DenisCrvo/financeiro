-- ============================================================================
-- Migration 0006_remove_payroll_module.sql
-- Remove por completo o módulo de Folha de Pagamento — Empregada Doméstica
-- (introduzido nas migrations 0003-0005), a pedido do usuário. O foco do
-- sistema volta a ser exclusivamente o cadastro financeiro (cartões de
-- crédito e despesas fixas) e o Dashboard.
--
-- Ordem de DROP respeita as dependências de chave estrangeira (tabelas
-- filhas antes das tabelas pai). Os triggers de cada tabela (imutabilidade
-- e auditoria) são removidos automaticamente pelo SQLite junto com a
-- tabela a que pertencem — não é necessário DROP TRIGGER explícito.
-- ============================================================================

DROP TABLE IF EXISTS folha_lancamentos_financeiros;
DROP TABLE IF EXISTS folha_rubricas;
DROP TABLE IF EXISTS folha_pagamento;
DROP TABLE IF EXISTS rubricas;
DROP TABLE IF EXISTS parametros_legais;
DROP TABLE IF EXISTS funcionarios;
