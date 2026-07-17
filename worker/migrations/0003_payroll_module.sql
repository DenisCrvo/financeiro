-- ============================================================================
-- Migration 0003_payroll_module.sql
-- Módulo de Folha de Pagamento — Empregada Doméstica
--
-- Base legal geral: Lei Complementar nº 150/2015 (Estatuto do Trabalhador
-- Doméstico), CLT (aplicação subsidiária), Emenda Constitucional nº 103/2019
-- (unificação da tabela de contribuição do INSS), Lei 8.036/1990 (FGTS),
-- Lei 8.212/1991 (custeio da Seguridade Social), Lei 7.418/1985 e Decreto
-- 95.247/1987 (Vale-Transporte), e a documentação técnica do eSocial
-- Doméstico (Simples Doméstico / DAE).
--
-- Este módulo NÃO recria o cadastro completo de funcionários: recria apenas
-- os dados mínimos de identificação, já que o cadastro anterior (Sessão
-- "Funcionária") foi removido do sistema a pedido do usuário (migration
-- 0002) e o módulo de folha precisa de alguma referência (funcionaria_id).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- funcionarios
-- Identificação mínima da(s) empregada(s) doméstica(s). Não é um módulo de
-- "lançamento mensal" (isso é responsabilidade da tabela folha_pagamento) —
-- é só o cadastro estável exigido pelo eSocial (equivalente aos dados dos
-- eventos S-2200/S-2205: admissão e alterações cadastrais).
-- ----------------------------------------------------------------------------
CREATE TABLE funcionarios (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                TEXT    NOT NULL,
    cpf                 TEXT    NOT NULL UNIQUE,
    nis                 TEXT,
    data_admissao       TEXT    NOT NULL,   -- ISO 8601 (YYYY-MM-DD)
    cargo               TEXT    NOT NULL DEFAULT 'Empregado(a) Doméstico(a)',
    categoria_esocial   TEXT    NOT NULL DEFAULT '104',  -- Tabela 1 eSocial: 104 = Empregado doméstico
    dependentes_irrf    INTEGER NOT NULL DEFAULT 0 CHECK (dependentes_irrf >= 0),
    situacao            TEXT    NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'afastado', 'desligado')),
    data_desligamento   TEXT,
    criado_em           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    atualizado_em       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_funcionarios_situacao ON funcionarios (situacao);

-- ----------------------------------------------------------------------------
-- rubricas
-- Estrutura equivalente ao conceito do evento S-1010 do eSocial (Tabela de
-- Rubricas): cada rubrica declara sua natureza (Tabela 3 do eSocial) e como
-- incide sobre INSS, FGTS e IRRF. Toda regra de incidência é dado, não código.
-- ----------------------------------------------------------------------------
CREATE TABLE rubricas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo              TEXT    NOT NULL UNIQUE,
    descricao           TEXT    NOT NULL,
    natureza_esocial    TEXT    NOT NULL,  -- código da Tabela 3 do eSocial (ex.: 1005, 1013, 1046...)
    tipo                TEXT    NOT NULL CHECK (tipo IN ('provento', 'desconto')),
    incidencia_inss     INTEGER NOT NULL DEFAULT 0 CHECK (incidencia_inss IN (0, 1)),
    incidencia_irrf     INTEGER NOT NULL DEFAULT 0 CHECK (incidencia_irrf IN (0, 1)),
    incidencia_fgts     INTEGER NOT NULL DEFAULT 0 CHECK (incidencia_fgts IN (0, 1)),
    ativo               INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    criado_em           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- parametros_legais
-- Tabelas oficiais (INSS, IRRF, FGTS, encargos patronais, VT) versionadas por
-- competência. Nenhum percentual ou faixa fica fixo no código-fonte — tudo é
-- lido daqui pelo motor de cálculo. Um novo registro deve ser criado sempre
-- que a legislação for atualizada (normalmente uma vez ao ano); o registro
-- vigente é o de maior competencia_inicio que seja <= à competência da folha.
-- ----------------------------------------------------------------------------
CREATE TABLE parametros_legais (
    id                              INTEGER PRIMARY KEY AUTOINCREMENT,
    competencia_inicio              TEXT    NOT NULL UNIQUE,  -- ISO (YYYY-MM-01): a partir de quando vigora
    fonte_legal                     TEXT    NOT NULL,          -- referência normativa (auditoria)
    -- Tabela progressiva do INSS (Tabela 1 - segurado empregado/doméstico),
    -- cálculo por faixas marginais desde a EC 103/2019 (fim do cálculo por
    -- alíquota única sobre o total).
    tabela_inss_json                TEXT    NOT NULL,  -- JSON: [{"ate": 1412.00, "aliquota": 0.075}, ...]
    teto_inss                       REAL    NOT NULL,  -- teto do salário de contribuição (Art. 28, §5º, Lei 8.212/1991)
    -- Tabela progressiva do IRRF mensal (Lei 9.250/1995, atualizada por lei
    -- específica a cada reajuste), método "alíquota x base - parcela a deduzir".
    tabela_irrf_json                TEXT    NOT NULL,  -- JSON: [{"ate": 2259.20, "aliquota": 0, "parcela_deduzir": 0}, ...]
    deducao_dependente_irrf         REAL    NOT NULL,  -- Art. 4º, III, Lei 9.250/1995
    desconto_simplificado_irrf      REAL    NOT NULL DEFAULT 0,  -- Lei 13.988/2020 art. 10 (opcional, substitutivo)
    -- FGTS — Lei 8.036/1990 (8%) + LC 150/2015 art. 22 (3,2% indenizatório,
    -- exclusivo do empregador doméstico via Simples Doméstico/FGTS Digital).
    percentual_fgts                 REAL    NOT NULL DEFAULT 0.08,
    percentual_fgts_indenizatorio   REAL    NOT NULL DEFAULT 0.032,
    -- Encargos patronais do empregador doméstico (LC 150/2015 art. 24 e 34;
    -- Lei 8.212/1991 art. 22-A — RAT fixo de 0,8% para o doméstico).
    percentual_inss_patronal        REAL    NOT NULL DEFAULT 0.08,
    percentual_rat                  REAL    NOT NULL DEFAULT 0.008,
    -- Vale-Transporte — Lei 7.418/1985 art. 4º c/c Decreto 95.247/1987 art. 32.
    percentual_vt_padrao            REAL    NOT NULL DEFAULT 0.06,
    criado_em                       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_parametros_legais_competencia ON parametros_legais (competencia_inicio);

-- ----------------------------------------------------------------------------
-- folha_pagamento
-- Uma linha por (funcionaria_id, competência). Congela ao ser fechada
-- (status = 'fechada') — trigger abaixo impede qualquer alteração posterior.
-- ----------------------------------------------------------------------------
CREATE TABLE folha_pagamento (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    funcionaria_id          INTEGER NOT NULL REFERENCES funcionarios (id) ON DELETE RESTRICT,
    competencia             TEXT    NOT NULL,  -- ISO (YYYY-MM-01)

    -- Verbas informadas manualmente (o sistema NÃO calcula automaticamente)
    salario_base            REAL    NOT NULL CHECK (salario_base >= 0),
    horas_extras            REAL    NOT NULL DEFAULT 0 CHECK (horas_extras >= 0),
    adicional_noturno       REAL    NOT NULL DEFAULT 0 CHECK (adicional_noturno >= 0),
    insalubridade           REAL    NOT NULL DEFAULT 0 CHECK (insalubridade >= 0),
    periculosidade          REAL    NOT NULL DEFAULT 0 CHECK (periculosidade >= 0),
    comissoes               REAL    NOT NULL DEFAULT 0 CHECK (comissoes >= 0),
    outras_verbas           REAL    NOT NULL DEFAULT 0 CHECK (outras_verbas >= 0),
    descontos               REAL    NOT NULL DEFAULT 0 CHECK (descontos >= 0),

    -- Vale-Transporte (Lei 7.418/1985)
    dias_uteis              INTEGER NOT NULL DEFAULT 0 CHECK (dias_uteis >= 0),
    valor_passagem_dia      REAL    NOT NULL DEFAULT 0 CHECK (valor_passagem_dia >= 0),
    percentual_desconto_vt  REAL    NOT NULL,  -- copiado de parametros_legais no momento do processamento
    valor_vt_depositado     REAL    NOT NULL DEFAULT 0 CHECK (valor_vt_depositado >= 0),
    desconto_vt             REAL    NOT NULL DEFAULT 0 CHECK (desconto_vt >= 0),

    -- Resultado do motor de cálculo
    salario_bruto           REAL    NOT NULL CHECK (salario_bruto >= 0),
    base_inss               REAL    NOT NULL CHECK (base_inss >= 0),
    valor_inss              REAL    NOT NULL CHECK (valor_inss >= 0),
    base_irrf               REAL    NOT NULL CHECK (base_irrf >= 0),
    valor_irrf              REAL    NOT NULL CHECK (valor_irrf >= 0),
    base_fgts               REAL    NOT NULL CHECK (base_fgts >= 0),
    valor_fgts              REAL    NOT NULL CHECK (valor_fgts >= 0),
    valor_fgts_indenizatorio REAL   NOT NULL DEFAULT 0 CHECK (valor_fgts_indenizatorio >= 0),
    encargos_empregador     REAL    NOT NULL CHECK (encargos_empregador >= 0),
    salario_liquido         REAL    NOT NULL,

    -- Controle
    parametros_legais_id    INTEGER NOT NULL REFERENCES parametros_legais (id) ON DELETE RESTRICT,
    status                  TEXT    NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada')),
    data_processamento      TEXT,
    criado_em               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    atualizado_em           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

    UNIQUE (funcionaria_id, competencia)
);

CREATE INDEX idx_folha_pagamento_competencia ON folha_pagamento (competencia);
CREATE INDEX idx_folha_pagamento_funcionaria ON folha_pagamento (funcionaria_id);

-- ----------------------------------------------------------------------------
-- folha_rubricas
-- Detalhamento das verbas/descontos por rubrica (compatível com o evento
-- S-1200 do eSocial, que exige a demonstração de cada rubrica paga/descontada).
-- ----------------------------------------------------------------------------
CREATE TABLE folha_rubricas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    folha_id    INTEGER NOT NULL REFERENCES folha_pagamento (id) ON DELETE CASCADE,
    rubrica_id  INTEGER NOT NULL REFERENCES rubricas (id) ON DELETE RESTRICT,
    valor       REAL    NOT NULL CHECK (valor >= 0),
    criado_em   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_folha_rubricas_folha ON folha_rubricas (folha_id);

-- ----------------------------------------------------------------------------
-- folha_lancamentos_financeiros
-- Integração financeira: registrado automaticamente ao fechar a folha
-- (salário líquido, Vale-Transporte custeado, encargos do empregador).
-- ----------------------------------------------------------------------------
CREATE TABLE folha_lancamentos_financeiros (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    folha_id        INTEGER NOT NULL REFERENCES folha_pagamento (id) ON DELETE RESTRICT,
    tipo            TEXT    NOT NULL CHECK (tipo IN ('salario', 'vale_transporte', 'encargos_empregador')),
    valor           REAL    NOT NULL CHECK (valor >= 0),
    descricao       TEXT,
    data_lancamento TEXT    NOT NULL,
    criado_em       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_folha_lancamentos_folha ON folha_lancamentos_financeiros (folha_id);

-- ============================================================================
-- Triggers de imutabilidade — uma folha fechada não pode mais ser alterada
-- ou excluída, garantindo o histórico para auditoria exigido pelo eSocial.
-- ============================================================================

CREATE TRIGGER trg_folha_pagamento_bloqueia_update_fechada
BEFORE UPDATE ON folha_pagamento
FOR EACH ROW
WHEN OLD.status = 'fechada'
BEGIN
    SELECT RAISE(ABORT, 'Folha de pagamento fechada não pode ser alterada.');
END;

CREATE TRIGGER trg_folha_pagamento_bloqueia_delete_fechada
BEFORE DELETE ON folha_pagamento
FOR EACH ROW
WHEN OLD.status = 'fechada'
BEGIN
    SELECT RAISE(ABORT, 'Folha de pagamento fechada não pode ser excluída.');
END;

CREATE TRIGGER trg_folha_rubricas_bloqueia_folha_fechada
BEFORE INSERT ON folha_rubricas
FOR EACH ROW
WHEN (SELECT status FROM folha_pagamento WHERE id = NEW.folha_id) = 'fechada'
BEGIN
    SELECT RAISE(ABORT, 'Não é possível incluir rubricas em folha já fechada.');
END;

-- ============================================================================
-- Triggers de auditoria — reaproveitam a tabela audit_log já existente
-- ============================================================================

CREATE TRIGGER trg_folha_pagamento_audit_insert
AFTER INSERT ON folha_pagamento
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('folha_pagamento', NEW.id, 'INSERT', json_object(
        'funcionaria_id', NEW.funcionaria_id, 'competencia', NEW.competencia,
        'salario_bruto', NEW.salario_bruto, 'salario_liquido', NEW.salario_liquido,
        'status', NEW.status
    ));
END;

CREATE TRIGGER trg_folha_pagamento_audit_update
AFTER UPDATE ON folha_pagamento
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('folha_pagamento', NEW.id, 'UPDATE',
        json_object('status', OLD.status, 'salario_liquido', OLD.salario_liquido),
        json_object('status', NEW.status, 'salario_liquido', NEW.salario_liquido)
    );
END;

CREATE TRIGGER trg_folha_pagamento_audit_delete
AFTER DELETE ON folha_pagamento
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value)
    VALUES ('folha_pagamento', OLD.id, 'DELETE', json_object(
        'funcionaria_id', OLD.funcionaria_id, 'competencia', OLD.competencia
    ));
END;

CREATE TRIGGER trg_funcionarios_audit_insert
AFTER INSERT ON funcionarios
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_value)
    VALUES ('funcionarios', NEW.id, 'INSERT', json_object('nome', NEW.nome, 'cpf', NEW.cpf));
END;

-- NOTA: atualizado_em é definido explicitamente pela aplicação a cada UPDATE
-- (não por um trigger com UPDATE aninhado — essa abordagem foi testada e
-- descartada na migration 0001 por duplicar entradas no audit_log).
CREATE TRIGGER trg_funcionarios_audit_update
AFTER UPDATE ON funcionarios
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_value, new_value)
    VALUES ('funcionarios', NEW.id, 'UPDATE',
        json_object('situacao', OLD.situacao), json_object('situacao', NEW.situacao)
    );
END;

-- ============================================================================
-- Seed — Rubricas (equivalente ao evento S-1010 do eSocial)
-- Códigos de natureza conforme Tabela 3 do leiaute do eSocial.
-- ============================================================================
INSERT INTO rubricas (codigo, descricao, natureza_esocial, tipo, incidencia_inss, incidencia_irrf, incidencia_fgts, ativo) VALUES
    ('SAL-BASE',  'Salário Base',                    '1005', 'provento', 1, 1, 1, 1),
    ('HR-EXTRA',  'Horas Extras',                     '1010', 'provento', 1, 1, 1, 1),
    ('AD-NOTURNO','Adicional Noturno',                '1022', 'provento', 1, 1, 1, 1),
    ('INSALUB',   'Adicional de Insalubridade',       '1019', 'provento', 1, 1, 1, 1),
    ('PERICUL',   'Adicional de Periculosidade',      '1020', 'provento', 1, 1, 1, 1),
    ('COMISSAO',  'Comissões',                        '1014', 'provento', 1, 1, 1, 1),
    ('OUTRAS-V',  'Outras Verbas Tributáveis',        '1099', 'provento', 1, 1, 1, 1),
    ('DESC-DIV',  'Descontos Diversos',               '9099', 'desconto', 0, 0, 0, 1),
    ('DESC-VT',   'Desconto de Vale-Transporte',      '9205', 'desconto', 0, 0, 0, 1),
    ('DESC-INSS', 'Desconto de INSS do Empregado',    '9201', 'desconto', 0, 0, 0, 1),
    ('DESC-IRRF', 'Desconto de IRRF',                 '9203', 'desconto', 0, 0, 0, 1);

-- ============================================================================
-- Seed — Parâmetros legais
-- Tabelas oficiais vigentes a partir de 01/2024 (últimos valores que podem
-- ser confirmados com segurança neste momento):
--   INSS: Portaria Interministerial MPS/MF nº 2, de 11/01/2024
--   IRRF: Lei nº 14.663/2023 (tabela vigente a partir de 02/2024)
--   FGTS: Lei 8.036/1990 art. 15 (8%) + LC 150/2015 art. 22 (3,2% indenizatório)
--   Encargos patronais: LC 150/2015 art. 24 (INSS patronal 8%) e Lei
--     8.212/1991 art. 22-A (RAT doméstico fixo, 0,8%)
--   VT: Lei 7.418/1985 art. 4º (6%)
--
-- >>> IMPORTANTE: estes valores DEVEM ser conferidos e atualizados antes de
-- processar folha real. Ver worker/PAYROLL.md, seção "Atualização anual".
-- ============================================================================
INSERT INTO parametros_legais (
    competencia_inicio, fonte_legal, tabela_inss_json, teto_inss, tabela_irrf_json,
    deducao_dependente_irrf, desconto_simplificado_irrf,
    percentual_fgts, percentual_fgts_indenizatorio,
    percentual_inss_patronal, percentual_rat, percentual_vt_padrao
) VALUES (
    '2024-01-01',
    'INSS: Portaria Interministerial MPS/MF nº 2/2024. IRRF: Lei nº 14.663/2023 (vigência 02/2024). FGTS: Lei 8.036/1990 + LC 150/2015 art. 22. Encargos: LC 150/2015 art. 24 e Lei 8.212/1991 art. 22-A. VT: Lei 7.418/1985.',
    '[{"ate":1412.00,"aliquota":0.075},{"ate":2666.68,"aliquota":0.09},{"ate":4000.03,"aliquota":0.12},{"ate":7786.02,"aliquota":0.14}]',
    7786.02,
    '[{"ate":2259.20,"aliquota":0,"parcela_deduzir":0},{"ate":2826.65,"aliquota":0.075,"parcela_deduzir":169.44},{"ate":3751.05,"aliquota":0.15,"parcela_deduzir":381.44},{"ate":4664.68,"aliquota":0.225,"parcela_deduzir":662.77},{"ate":null,"aliquota":0.275,"parcela_deduzir":896.00}]',
    189.59,
    564.80,
    0.08, 0.032,
    0.08, 0.008,
    0.06
);
