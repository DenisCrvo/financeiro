// Motor de Cálculo da Folha de Pagamento — orquestra os módulos de domínio
// (VT, INSS, IRRF, FGTS, Encargos) sem qualquer acesso a banco de dados ou
// à interface. Recebe dados já carregados (verbas, parâmetros legais da
// competência, rubricas ativas) e devolve o resultado completo do
// processamento, pronto para ser persistido pela camada de rotas.
//
// Mantém o princípio de que NENHUMA verba é calculada automaticamente
// (horas extras, adicional noturno etc. são informadas pelo usuário) — este
// motor apenas aplica a legislação sobre os valores informados.

import { round2 } from './money.js';
import { calcularValeTransporte } from './vtCalculator.js';
import { calcularINSS } from './inssCalculator.js';
import { calcularIRRF } from './irrfCalculator.js';
import { calcularFGTS } from './fgtsCalculator.js';
import { calcularEncargosEmpregador } from './encargosEmpregadorCalculator.js';

// Mapeia cada campo de verba manual para o código da rubrica correspondente
// (ver seed de `rubricas` na migration 0003 — conceito do evento S-1010).
export const VERBA_RUBRICA_CODIGO = {
  salario_base: 'SAL-BASE',
  horas_extras: 'HR-EXTRA',
  adicional_noturno: 'AD-NOTURNO',
  insalubridade: 'INSALUB',
  periculosidade: 'PERICUL',
  comissoes: 'COMISSAO',
  outras_verbas: 'OUTRAS-V',
};

/**
 * @param {object} params
 * @param {object} params.verbas {salario_base, horas_extras, adicional_noturno, insalubridade, periculosidade, comissoes, outras_verbas, descontos}
 * @param {object} params.vt {dias_uteis, valor_passagem_dia, percentual_desconto_vt}
 * @param {number} params.dependentesIrrf nº de dependentes para dedução do IRRF (cadastral, vem de `funcionarios`)
 * @param {Map<string, {id:number, incidencia_inss:boolean, incidencia_irrf:boolean, incidencia_fgts:boolean}>} params.rubricasPorCodigo
 * @param {object} params.parametrosLegais linha vigente de `parametros_legais` (já com JSON parseado)
 * @returns {object} resultado completo pronto para persistir em folha_pagamento + folha_rubricas
 */
export function calcularFolha({ verbas, vt, dependentesIrrf, rubricasPorCodigo, parametrosLegais }) {
  const rubricasFolha = [];
  let salarioBruto = 0;
  let baseInssBruta = 0;
  let baseIrrfBruta = 0;
  let baseFgtsBruta = 0;

  for (const [campo, codigoRubrica] of Object.entries(VERBA_RUBRICA_CODIGO)) {
    const valor = Number(verbas[campo]) || 0;
    if (valor <= 0) continue;

    const rubrica = rubricasPorCodigo.get(codigoRubrica);
    if (!rubrica) continue; // rubrica inativada pelo usuário: verba não é considerada

    salarioBruto += valor;
    if (rubrica.incidencia_inss) baseInssBruta += valor;
    if (rubrica.incidencia_irrf) baseIrrfBruta += valor;
    if (rubrica.incidencia_fgts) baseFgtsBruta += valor;

    rubricasFolha.push({ rubrica_id: rubrica.id, codigo: codigoRubrica, valor: round2(valor) });
  }
  salarioBruto = round2(salarioBruto);

  // INSS do empregado — base limitada ao teto de contribuição (Art. 28,
  // §5º, Lei 8.212/1991); cálculo progressivo por faixas (EC 103/2019).
  const inss = calcularINSS(baseInssBruta, parametrosLegais.tabela_inss, parametrosLegais.teto_inss);

  // IRRF — a base já desconta o INSS do empregado e a dedução por
  // dependente (Lei 9.250/1995, art. 4º).
  const irrf = calcularIRRF(
    { rendimentoTributavel: round2(baseIrrfBruta), valorInss: inss.valorInss, numDependentes: dependentesIrrf },
    parametrosLegais.tabela_irrf,
    parametrosLegais.deducao_dependente_irrf
  );

  // FGTS — depósito mensal (8%) + indenizatório (3,2%, exclusivo do
  // doméstico, LC 150/2015 art. 22).
  const fgts = calcularFGTS(baseFgtsBruta, {
    percentualFgts: parametrosLegais.percentual_fgts,
    percentualFgtsIndenizatorio: parametrosLegais.percentual_fgts_indenizatorio,
  });

  // Encargos patronais (INSS patronal + RAT) — IMPORTANTE: a base do INSS
  // patronal NÃO tem teto (o teto do Art. 28 §5º da Lei 8.212/1991 é
  // exclusivo da contribuição do segurado/empregado), por isso usamos a
  // base bruta (baseInssBruta), não o valor já limitado pelo INSS do
  // empregado (inss.baseInss).
  const encargos = calcularEncargosEmpregador(baseInssBruta, {
    percentualInssPatronal: parametrosLegais.percentual_inss_patronal,
    percentualRat: parametrosLegais.percentual_rat,
  });

  // Vale-Transporte — benefício apartado, sem incidência tributária (ver
  // vtCalculator.js).
  const percentualVt = vt.percentual_desconto_vt ?? parametrosLegais.percentual_vt_padrao;
  const valeTransporte = calcularValeTransporte({
    diasUteis: Number(vt.dias_uteis) || 0,
    valorPassagemDia: Number(vt.valor_passagem_dia) || 0,
    percentualDesconto: percentualVt,
    salarioBase: Number(verbas.salario_base) || 0,
  });

  const descontosDiversos = round2(Number(verbas.descontos) || 0);
  const salarioLiquido = round2(
    salarioBruto - inss.valorInss - irrf.valorIrrf - descontosDiversos - valeTransporte.descontoVt
  );

  return {
    rubricasFolha,
    salario_bruto: salarioBruto,
    base_inss: inss.baseInss,
    valor_inss: inss.valorInss,
    base_irrf: irrf.baseIrrf,
    valor_irrf: irrf.valorIrrf,
    base_fgts: round2(baseFgtsBruta),
    valor_fgts: fgts.valorFgts,
    valor_fgts_indenizatorio: fgts.valorFgtsIndenizatorio,
    encargos_empregador: encargos.total,
    percentual_desconto_vt: percentualVt,
    valor_vt_depositado: valeTransporte.valorVtDepositado,
    desconto_vt: valeTransporte.descontoVt,
    custo_empregador_vt: valeTransporte.custoEmpregador,
    salario_liquido: salarioLiquido,
  };
}
