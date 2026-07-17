-- ============================================================================
-- Migration 0005_update_legal_parameters.sql
-- Atualiza os parâmetros legais com base em conferência real feita pelo
-- usuário contra o eSocial Doméstico oficial (simulação de folha real,
-- competência 05/2026):
--
--   • INSS empregado: tabela de faixas fornecida pelo usuário (conferida
--     matematicamente contra o método "faixa × alíquota − parcela a
--     deduzir" — bate exato com o cálculo progressivo já implementado).
--   • IRRF: confirmado que o valor do desconto simplificado (Lei
--     13.988/2020, art. 10) vigente é R$ 607,20 — derivado com certeza
--     matemática a partir da Base IRRF real informada pelo usuário
--     (R$ 1.013,80 = R$ 1.621,00 − R$ 607,20).
--
-- Como instruído em worker/PAYROLL.md ("nunca edite uma linha já usada"),
-- isso entra como uma NOVA versão, não uma alteração da linha de 2024.
-- ============================================================================

INSERT INTO parametros_legais (
    competencia_inicio, fonte_legal, tabela_inss_json, teto_inss, tabela_irrf_json,
    deducao_dependente_irrf, desconto_simplificado_irrf,
    percentual_fgts, percentual_fgts_indenizatorio,
    percentual_inss_patronal, percentual_rat, percentual_vt_padrao
) VALUES (
    '2025-01-01',
    'INSS: tabela oficial conferida pelo usuário contra o eSocial Doméstico real (competência 05/2026). IRRF: desconto simplificado (Lei 13.988/2020, art. 10) derivado matematicamente de simulação real no eSocial (Base IRRF = Salário Bruto − R$607,20). Demais percentuais (FGTS, encargos, VT) mantidos da versão anterior por não haver evidência de mudança.',
    '[{"ate":1621.00,"aliquota":0.075},{"ate":2902.84,"aliquota":0.09},{"ate":4354.27,"aliquota":0.12},{"ate":8475.55,"aliquota":0.14}]',
    8475.55,
    '[{"ate":2259.20,"aliquota":0,"parcela_deduzir":0},{"ate":2826.65,"aliquota":0.075,"parcela_deduzir":169.44},{"ate":3751.05,"aliquota":0.15,"parcela_deduzir":381.44},{"ate":4664.68,"aliquota":0.225,"parcela_deduzir":662.77},{"ate":null,"aliquota":0.275,"parcela_deduzir":896.00}]',
    189.59,
    607.20,
    0.08, 0.032,
    0.08, 0.008,
    0.06
);
