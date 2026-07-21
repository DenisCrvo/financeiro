-- ============================================================================
-- Migration 0010_funcionaria_editable_value.sql
-- A seção Funcionária — Pagamento Mensal não tinha um campo de lançamento
-- de valor: só a função de cálculo de Vale-Transporte (dias úteis × valor
-- da passagem). Esta migration renomeia `valor_vt` para `valor_pagar`,
-- que passa a ser um valor informado/editável pelo usuário (o cálculo de
-- VT apenas preenche automaticamente esse campo como ponto de partida,
-- podendo ser ajustado antes de salvar — mesmo padrão do campo "Valor"
-- de Despesas Fixas). A coluna `description` (opcional) é removida, a
-- pedido do usuário.
--
-- Não há dados reais a preservar (confirmado vazia em produção nesta
-- mesma sessão), por isso a tabela é recriada do zero.
-- ============================================================================

DROP TABLE IF EXISTS funcionaria_pagamentos;

CREATE TABLE funcionaria_pagamentos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_type_id     INTEGER NOT NULL REFERENCES funcionaria_expense_types (id) ON DELETE RESTRICT,
    year                INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month               INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    dias_uteis          INTEGER NOT NULL DEFAULT 0 CHECK (dias_uteis >= 0),
    valor_passagem_dia  REAL    NOT NULL DEFAULT 0 CHECK (valor_passagem_dia >= 0),
    valor_pagar         REAL    NOT NULL CHECK (valor_pagar >= 0),
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
        'expense_type_id', NEW.expense_type_id, 'year', NEW.year, 'month', NEW.month, 'valor_pagar', NEW.valor_pagar
    ));
END;

CREATE TRIGGER trg_funcionaria_pagamentos_audit_update
AFTER UPDATE ON funcionaria_pagamentos
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('funcionaria_pagamentos', NEW.id, 'UPDATE',
        json_object('dias_uteis', OLD.dias_uteis, 'valor_passagem_dia', OLD.valor_passagem_dia, 'valor_pagar', OLD.valor_pagar),
        json_object('dias_uteis', NEW.dias_uteis, 'valor_passagem_dia', NEW.valor_passagem_dia, 'valor_pagar', NEW.valor_pagar)
    );
END;

CREATE TRIGGER trg_funcionaria_pagamentos_audit_delete
AFTER DELETE ON funcionaria_pagamentos
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value)
    VALUES ('funcionaria_pagamentos', OLD.id, 'DELETE', json_object(
        'expense_type_id', OLD.expense_type_id, 'year', OLD.year, 'month', OLD.month, 'valor_pagar', OLD.valor_pagar
    ));
END;
