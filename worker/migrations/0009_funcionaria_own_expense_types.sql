-- ============================================================================
-- Migration 0009_funcionaria_own_expense_types.sql
-- A lista de "Tipo de despesa" da seção Funcionária — Pagamento Mensal
-- estava compartilhando a mesma tabela `expense_types` de Despesas Fixas.
-- Esta migration cria uma taxonomia própria (`funcionaria_expense_types`)
-- e reaponta `funcionaria_pagamentos.expense_type_id` para ela, para que
-- as duas listas funcionem de forma independente.
--
-- Não há dados reais a preservar em funcionaria_pagamentos (confirmado
-- vazia em produção nesta mesma sessão), por isso a tabela é recriada do
-- zero em vez de um rebuild com preservação de dados.
-- ============================================================================

CREATE TABLE funcionaria_expense_types (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    icon        TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

DROP TABLE IF EXISTS funcionaria_pagamentos;

CREATE TABLE funcionaria_pagamentos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_type_id     INTEGER NOT NULL REFERENCES funcionaria_expense_types (id) ON DELETE RESTRICT,
    year                INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month               INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    dias_uteis          INTEGER NOT NULL DEFAULT 0 CHECK (dias_uteis >= 0),
    valor_passagem_dia  REAL    NOT NULL DEFAULT 0 CHECK (valor_passagem_dia >= 0),
    valor_vt            REAL    NOT NULL CHECK (valor_vt >= 0),
    description         TEXT,
    batch_id            TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (expense_type_id, year, month)
);

CREATE INDEX idx_funcionaria_pagamentos_year_month ON funcionaria_pagamentos (year, month);
CREATE INDEX idx_funcionaria_pagamentos_type ON funcionaria_pagamentos (expense_type_id);

-- ----------------------------------------------------------------------------
-- Auditoria (mesmo padrão de fixed_expenses/credit_cards).
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_funcionaria_pagamentos_audit_insert
AFTER INSERT ON funcionaria_pagamentos
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('funcionaria_pagamentos', NEW.id, 'INSERT', json_object(
        'expense_type_id', NEW.expense_type_id, 'year', NEW.year, 'month', NEW.month, 'valor_vt', NEW.valor_vt
    ));
END;

CREATE TRIGGER trg_funcionaria_pagamentos_audit_update
AFTER UPDATE ON funcionaria_pagamentos
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('funcionaria_pagamentos', NEW.id, 'UPDATE',
        json_object('dias_uteis', OLD.dias_uteis, 'valor_passagem_dia', OLD.valor_passagem_dia, 'valor_vt', OLD.valor_vt),
        json_object('dias_uteis', NEW.dias_uteis, 'valor_passagem_dia', NEW.valor_passagem_dia, 'valor_vt', NEW.valor_vt)
    );
END;

CREATE TRIGGER trg_funcionaria_pagamentos_audit_delete
AFTER DELETE ON funcionaria_pagamentos
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value)
    VALUES ('funcionaria_pagamentos', OLD.id, 'DELETE', json_object(
        'expense_type_id', OLD.expense_type_id, 'year', OLD.year, 'month', OLD.month, 'valor_vt', OLD.valor_vt
    ));
END;
