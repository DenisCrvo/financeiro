-- ============================================================================
-- Migration 0007_add_funcionaria_payments.sql
-- Recria uma seção de pagamento à Funcionária, agora no mesmo formato de
-- lançamento simples usado em `fixed_expenses` (sem cadastro de RH, sem
-- motor de cálculo de encargos/tributos — apenas o registro do pagamento
-- mensal), incluindo o cálculo do Vale-Transporte (Lei 7.418/1985):
-- valor_vt = dias_uteis × valor_passagem_dia (valor já considerado ida+volta).
-- ============================================================================

CREATE TABLE funcionaria_pagamentos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                TEXT,
    year                INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month               INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    salario             REAL    NOT NULL CHECK (salario >= 0),
    dias_uteis          INTEGER NOT NULL DEFAULT 0 CHECK (dias_uteis >= 0),
    valor_passagem_dia  REAL    NOT NULL DEFAULT 0 CHECK (valor_passagem_dia >= 0),
    valor_vt            REAL    NOT NULL DEFAULT 0 CHECK (valor_vt >= 0),
    valor_total         REAL    NOT NULL CHECK (valor_total >= 0),
    description         TEXT,
    batch_id            TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (year, month)
);

CREATE INDEX idx_funcionaria_pagamentos_year_month ON funcionaria_pagamentos (year, month);

-- ----------------------------------------------------------------------------
-- Auditoria (mesmo padrão de fixed_expenses/credit_cards).
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_funcionaria_pagamentos_audit_insert
AFTER INSERT ON funcionaria_pagamentos
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('funcionaria_pagamentos', NEW.id, 'INSERT', json_object(
        'nome', NEW.nome, 'year', NEW.year, 'month', NEW.month,
        'salario', NEW.salario, 'valor_total', NEW.valor_total
    ));
END;

CREATE TRIGGER trg_funcionaria_pagamentos_audit_update
AFTER UPDATE ON funcionaria_pagamentos
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('funcionaria_pagamentos', NEW.id, 'UPDATE',
        json_object('salario', OLD.salario, 'dias_uteis', OLD.dias_uteis, 'valor_passagem_dia', OLD.valor_passagem_dia, 'valor_total', OLD.valor_total),
        json_object('salario', NEW.salario, 'dias_uteis', NEW.dias_uteis, 'valor_passagem_dia', NEW.valor_passagem_dia, 'valor_total', NEW.valor_total)
    );
END;

CREATE TRIGGER trg_funcionaria_pagamentos_audit_delete
AFTER DELETE ON funcionaria_pagamentos
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value)
    VALUES ('funcionaria_pagamentos', OLD.id, 'DELETE', json_object(
        'nome', OLD.nome, 'year', OLD.year, 'month', OLD.month, 'valor_total', OLD.valor_total
    ));
END;
