-- ============================================================================
-- Migration 0004_simplify_funcionarios.sql
-- O foco do sistema é o processamento financeiro da folha, não um cadastro
-- de RH completo. CPF, NIS, data de admissão, cargo e dependentes passam a
-- ser OPCIONAIS — a funcionária pode ser cadastrada só com o nome, e os
-- demais dados preenchidos depois (via edição), se e quando forem
-- necessários (ex.: para uma futura integração com o eSocial).
-- ============================================================================

-- Nota: `PRAGMA foreign_keys` não pode ser alternado dentro de uma
-- transação (e o D1 executa a migration inteira em uma) — por isso usamos
-- `defer_foreign_keys`, que adia a checagem de FKs até o fim da transação,
-- permitindo o DROP+CREATE+RENAME abaixo mesmo com folha_pagamento
-- referenciando funcionarios.id.
PRAGMA defer_foreign_keys = TRUE;

CREATE TABLE funcionarios_new (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                TEXT    NOT NULL,
    cpf                 TEXT    UNIQUE,
    nis                 TEXT,
    data_admissao       TEXT,
    cargo               TEXT    NOT NULL DEFAULT 'Empregado(a) Doméstico(a)',
    categoria_esocial   TEXT    NOT NULL DEFAULT '104',
    dependentes_irrf    INTEGER NOT NULL DEFAULT 0 CHECK (dependentes_irrf >= 0),
    situacao            TEXT    NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'afastado', 'desligado')),
    data_desligamento   TEXT,
    criado_em           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    atualizado_em       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO funcionarios_new (id, nome, cpf, nis, data_admissao, cargo, categoria_esocial, dependentes_irrf, situacao, data_desligamento, criado_em, atualizado_em)
SELECT id, nome, cpf, nis, data_admissao, cargo, categoria_esocial, dependentes_irrf, situacao, data_desligamento, criado_em, atualizado_em
FROM funcionarios;

DROP TABLE funcionarios;
ALTER TABLE funcionarios_new RENAME TO funcionarios;

CREATE INDEX idx_funcionarios_situacao ON funcionarios (situacao);

-- Recriar os triggers de auditoria (dropados junto com a tabela antiga).
CREATE TRIGGER trg_funcionarios_audit_insert
AFTER INSERT ON funcionarios
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('funcionarios', NEW.id, 'INSERT', json_object('nome', NEW.nome, 'cpf', NEW.cpf));
END;

CREATE TRIGGER trg_funcionarios_audit_update
AFTER UPDATE ON funcionarios
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('funcionarios', NEW.id, 'UPDATE',
        json_object('situacao', OLD.situacao), json_object('situacao', NEW.situacao)
    );
END;
