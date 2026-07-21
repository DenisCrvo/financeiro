-- ============================================================================
-- Migration 0011_add_avista_payments.sql
-- Nova seção "Pagamentos à Vista / PIX", no mesmo conceito de
-- Despesas Fixas (lançamento em lote por vários meses, categorizado por
-- um Tipo de Despesa), porém com uma taxonomia de tipos totalmente
-- própria (`avista_expense_types`) — independente de `expense_types`
-- (Despesas Fixas) e de `funcionaria_expense_types` (Funcionária).
-- ============================================================================

CREATE TABLE avista_expense_types (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    icon        TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- avista_payments
-- Lançamentos de pagamentos à vista/PIX. batch_id agrupa lançamentos
-- criados na mesma operação (ex.: seleção de vários meses de uma vez).
-- ----------------------------------------------------------------------------
CREATE TABLE avista_payments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_type_id  INTEGER NOT NULL REFERENCES avista_expense_types (id) ON DELETE RESTRICT,
    year             INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month            INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    value            REAL    NOT NULL CHECK (value >= 0),
    description      TEXT,
    batch_id         TEXT,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (expense_type_id, year, month)
);

CREATE INDEX idx_avista_payments_year_month ON avista_payments (year, month);
CREATE INDEX idx_avista_payments_type ON avista_payments (expense_type_id);

-- ----------------------------------------------------------------------------
-- Auditoria (mesmo padrão de fixed_expenses/credit_cards).
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_avista_payments_audit_insert
AFTER INSERT ON avista_payments
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('avista_payments', NEW.id, 'INSERT', json_object(
        'expense_type_id', NEW.expense_type_id, 'year', NEW.year, 'month', NEW.month, 'value', NEW.value
    ));
END;

CREATE TRIGGER trg_avista_payments_audit_update
AFTER UPDATE ON avista_payments
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('avista_payments', NEW.id, 'UPDATE',
        json_object('value', OLD.value, 'description', OLD.description),
        json_object('value', NEW.value, 'description', NEW.description)
    );
END;

CREATE TRIGGER trg_avista_payments_audit_delete
AFTER DELETE ON avista_payments
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value)
    VALUES ('avista_payments', OLD.id, 'DELETE', json_object(
        'expense_type_id', OLD.expense_type_id, 'year', OLD.year, 'month', OLD.month, 'value', OLD.value
    ));
END;
