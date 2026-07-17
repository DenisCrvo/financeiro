-- ============================================================================
-- Migration 0002_drop_employee_features.sql
-- Remove os cadastros de Funcionária e Controle de Adiantamentos: os
-- formulários correspondentes foram removidos do frontend, então as tabelas
-- e seus triggers de auditoria deixam de ser necessários.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_employee_monthly_audit_insert;
DROP TRIGGER IF EXISTS trg_employee_monthly_audit_update;
DROP TRIGGER IF EXISTS trg_employee_monthly_audit_delete;

DROP TRIGGER IF EXISTS trg_employee_advances_audit_insert;
DROP TRIGGER IF EXISTS trg_employee_advances_audit_update;
DROP TRIGGER IF EXISTS trg_employee_advances_audit_delete;

DELETE FROM audit_log WHERE table_name IN ('employee_monthly', 'employee_advances');

DROP TABLE IF EXISTS employee_monthly;
DROP TABLE IF EXISTS employee_advances;
