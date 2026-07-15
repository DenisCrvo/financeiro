-- ============================================================================
-- Migration 0001_init.sql
-- Sistema de Previsão de Despesas Pessoais — Cloudflare D1
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- credit_cards
-- Uma fatura por cartão/ano/mês. Valores parciais substituem o registro
-- anterior (guardamos o valor anterior para exibir "último valor registrado").
-- ----------------------------------------------------------------------------
CREATE TABLE credit_cards (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    card_name       TEXT    NOT NULL CHECK (card_name IN ('bradesco', 'nubank')),
    year            INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    value           REAL    NOT NULL CHECK (value >= 0),
    previous_value  REAL    CHECK (previous_value IS NULL OR previous_value >= 0),
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (card_name, year, month)
);

CREATE INDEX idx_credit_cards_year_month ON credit_cards (year, month);

-- ----------------------------------------------------------------------------
-- employee_monthly
-- Lançamento mensal da funcionária: dias trabalhados, transporte, férias,
-- 13º, desconto de adiantamento e guia e-social.
-- ----------------------------------------------------------------------------
CREATE TABLE employee_monthly (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    year                        INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month                       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    days_worked                 INTEGER NOT NULL DEFAULT 0 CHECK (days_worked >= 0),
    daily_transport_value       REAL    NOT NULL DEFAULT 0 CHECK (daily_transport_value >= 0),
    transport_value             REAL    NOT NULL DEFAULT 0 CHECK (transport_value >= 0),
    vacation_value              REAL    NOT NULL DEFAULT 0 CHECK (vacation_value >= 0),
    thirteenth_value            REAL    NOT NULL DEFAULT 0 CHECK (thirteenth_value >= 0),
    advance_discount_value      REAL    NOT NULL DEFAULT 0 CHECK (advance_discount_value >= 0),
    advance_discount_months     INTEGER NOT NULL DEFAULT 0 CHECK (advance_discount_months >= 0),
    esocial_value               REAL    NOT NULL DEFAULT 0 CHECK (esocial_value >= 0),
    created_at                  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at                  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (year, month)
);

CREATE INDEX idx_employee_monthly_year_month ON employee_monthly (year, month);

-- ----------------------------------------------------------------------------
-- employee_advances
-- Cronograma de descontos de adiantamento (empréstimo) à funcionária.
-- Cada linha representa UMA parcela (um mês) do adiantamento; várias linhas
-- com o mesmo batch_id compõem um único adiantamento lançado de uma vez,
-- no mesmo formato de seleção de meses usado em fixed_expenses.
-- Uso exclusivo para controle de desconto em folha/e-social — NÃO entra
-- nos totais do Dashboard (ver worker/src/routes/dashboard.js).
-- ----------------------------------------------------------------------------
CREATE TABLE employee_advances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id        TEXT    NOT NULL,
    year            INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    discount_value  REAL    NOT NULL CHECK (discount_value >= 0),
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_employee_advances_year_month ON employee_advances (year, month);
CREATE INDEX idx_employee_advances_batch ON employee_advances (batch_id);

-- ----------------------------------------------------------------------------
-- expense_types
-- Categorias de despesas fixas, cadastráveis dinamicamente pelo usuário.
-- ----------------------------------------------------------------------------
CREATE TABLE expense_types (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    icon        TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- fixed_expenses
-- Lançamentos de despesas fixas. batch_id agrupa lançamentos criados na
-- mesma operação (ex.: seleção de vários meses consecutivos de uma vez).
-- ----------------------------------------------------------------------------
CREATE TABLE fixed_expenses (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_type_id  INTEGER NOT NULL REFERENCES expense_types (id) ON DELETE RESTRICT,
    year             INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month            INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    value            REAL    NOT NULL CHECK (value >= 0),
    description      TEXT,
    batch_id         TEXT,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (expense_type_id, year, month)
);

CREATE INDEX idx_fixed_expenses_year_month ON fixed_expenses (year, month);
CREATE INDEX idx_fixed_expenses_type ON fixed_expenses (expense_type_id);

-- ----------------------------------------------------------------------------
-- audit_log
-- Histórico de alterações em todas as tabelas de lançamento.
-- ----------------------------------------------------------------------------
CREATE TABLE audit_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name   TEXT NOT NULL,
    record_id    INTEGER NOT NULL,
    operation    TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_value    TEXT,  -- JSON
    new_value    TEXT,  -- JSON
    changed_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_audit_log_table_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log (changed_at);

-- ============================================================================
-- Triggers: registrar auditoria em INSERT/UPDATE/DELETE
-- (updated_at é definido explicitamente pela aplicação a cada UPDATE — ver
-- worker/src/routes/*.js. Um trigger "auto-touch" via UPDATE aninhado foi
-- testado e descartado: no runtime do D1 ele fez o trigger de auditoria
-- disparar duas vezes para a mesma alteração, duplicando o audit_log.)
-- ============================================================================

-- credit_cards ---------------------------------------------------------------
CREATE TRIGGER trg_credit_cards_audit_insert
AFTER INSERT ON credit_cards
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('credit_cards', NEW.id, 'INSERT', json_object(
        'card_name', NEW.card_name, 'year', NEW.year, 'month', NEW.month, 'value', NEW.value
    ));
END;

CREATE TRIGGER trg_credit_cards_audit_update
AFTER UPDATE ON credit_cards
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('credit_cards', NEW.id, 'UPDATE',
        json_object('value', OLD.value),
        json_object('value', NEW.value)
    );
END;

CREATE TRIGGER trg_credit_cards_audit_delete
AFTER DELETE ON credit_cards
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value)
    VALUES ('credit_cards', OLD.id, 'DELETE', json_object(
        'card_name', OLD.card_name, 'year', OLD.year, 'month', OLD.month, 'value', OLD.value
    ));
END;

-- employee_monthly ------------------------------------------------------------
CREATE TRIGGER trg_employee_monthly_audit_insert
AFTER INSERT ON employee_monthly
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('employee_monthly', NEW.id, 'INSERT', json_object(
        'year', NEW.year, 'month', NEW.month, 'days_worked', NEW.days_worked,
        'transport_value', NEW.transport_value
    ));
END;

CREATE TRIGGER trg_employee_monthly_audit_update
AFTER UPDATE ON employee_monthly
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('employee_monthly', NEW.id, 'UPDATE',
        json_object(
            'days_worked', OLD.days_worked, 'transport_value', OLD.transport_value,
            'vacation_value', OLD.vacation_value, 'thirteenth_value', OLD.thirteenth_value,
            'advance_discount_value', OLD.advance_discount_value, 'esocial_value', OLD.esocial_value
        ),
        json_object(
            'days_worked', NEW.days_worked, 'transport_value', NEW.transport_value,
            'vacation_value', NEW.vacation_value, 'thirteenth_value', NEW.thirteenth_value,
            'advance_discount_value', NEW.advance_discount_value, 'esocial_value', NEW.esocial_value
        )
    );
END;

CREATE TRIGGER trg_employee_monthly_audit_delete
AFTER DELETE ON employee_monthly
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value)
    VALUES ('employee_monthly', OLD.id, 'DELETE', json_object('year', OLD.year, 'month', OLD.month));
END;

-- employee_advances ------------------------------------------------------------
CREATE TRIGGER trg_employee_advances_audit_insert
AFTER INSERT ON employee_advances
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('employee_advances', NEW.id, 'INSERT', json_object(
        'batch_id', NEW.batch_id, 'year', NEW.year, 'month', NEW.month, 'discount_value', NEW.discount_value
    ));
END;

CREATE TRIGGER trg_employee_advances_audit_update
AFTER UPDATE ON employee_advances
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('employee_advances', NEW.id, 'UPDATE',
        json_object('discount_value', OLD.discount_value),
        json_object('discount_value', NEW.discount_value)
    );
END;

CREATE TRIGGER trg_employee_advances_audit_delete
AFTER DELETE ON employee_advances
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value)
    VALUES ('employee_advances', OLD.id, 'DELETE', json_object(
        'batch_id', OLD.batch_id, 'year', OLD.year, 'month', OLD.month, 'discount_value', OLD.discount_value
    ));
END;

-- fixed_expenses ----------------------------------------------------------------
CREATE TRIGGER trg_fixed_expenses_audit_insert
AFTER INSERT ON fixed_expenses
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('fixed_expenses', NEW.id, 'INSERT', json_object(
        'expense_type_id', NEW.expense_type_id, 'year', NEW.year, 'month', NEW.month, 'value', NEW.value
    ));
END;

CREATE TRIGGER trg_fixed_expenses_audit_update
AFTER UPDATE ON fixed_expenses
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('fixed_expenses', NEW.id, 'UPDATE',
        json_object('value', OLD.value, 'description', OLD.description),
        json_object('value', NEW.value, 'description', NEW.description)
    );
END;

CREATE TRIGGER trg_fixed_expenses_audit_delete
AFTER DELETE ON fixed_expenses
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value)
    VALUES ('fixed_expenses', OLD.id, 'DELETE', json_object(
        'expense_type_id', OLD.expense_type_id, 'year', OLD.year, 'month', OLD.month, 'value', OLD.value
    ));
END;

-- ============================================================================
-- Seed inicial de tipos de despesas fixas mais comuns
-- ============================================================================
INSERT INTO expense_types (name, icon) VALUES
    ('Aluguel', 'bi-house-door'),
    ('Energia Elétrica', 'bi-lightning-charge'),
    ('Água', 'bi-droplet'),
    ('Internet', 'bi-wifi'),
    ('Telefone', 'bi-telephone'),
    ('Condomínio', 'bi-buildings'),
    ('IPTU', 'bi-file-earmark-text'),
    ('Seguro', 'bi-shield-check'),
    ('Educação', 'bi-mortarboard'),
    ('Saúde/Plano', 'bi-heart-pulse');
