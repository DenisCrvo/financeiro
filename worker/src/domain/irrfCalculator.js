// IRRF — Imposto de Renda Retido na Fonte sobre rendimentos do trabalho.
//
// Base legal: Lei 9.250/1995 (arts. 3º, 4º e 7º) e a lei que reajusta a
// tabela progressiva mensal vigente na competência (parametrizada, nunca
// fixa no código — ver tabela `parametros_legais`).
//
// Base de cálculo do IRRF (art. 4º, Lei 9.250/1995):
//   Base = Rendimento tributável (verbas com incidência IRRF)
//          (-) Contribuição previdenciária (INSS) do empregado
//          (-) Dedução por dependente × nº de dependentes
//          (-) Pensão alimentícia paga (se houver, informada como desconto)
//
// Cálculo do imposto: usa-se o método oficial "alíquota da faixa × base -
// parcela a deduzir" (Receita Federal), que é matematicamente equivalente ao
// cálculo progressivo por faixas (a "parcela a deduzir" já compensa o que
// seria tributado nas faixas inferiores a uma alíquota menor).
//
// Este módulo NÃO aplica o desconto simplificado (Lei 13.988/2020, art. 10)
// por padrão — ele é informado em `parametros_legais.desconto_simplificado_irrf`
// e pode ser usado no lugar das deduções por dependente/INSS caso seja mais
// vantajoso ao contribuinte; a decisão de qual método usar cabe ao usuário
// (ver worker/PAYROLL.md).
import { round2 } from './money.js';

/**
 * @param {{rendimentoTributavel:number, valorInss:number, numDependentes:number, pensaoAlimenticia?:number}} params
 * @param {Array<{ate:number|null, aliquota:number, parcela_deduzir:number}>} tabelaIrrf faixas em ordem crescente (última com ate:null)
 * @param {number} deducaoDependente valor de dedução por dependente da competência
 * @returns {{baseIrrf:number, valorIrrf:number}}
 */
export function calcularIRRF({ rendimentoTributavel, valorInss, numDependentes, pensaoAlimenticia = 0 }, tabelaIrrf, deducaoDependente) {
  const deducoes = valorInss + (numDependentes * deducaoDependente) + pensaoAlimenticia;
  const baseIrrf = Math.max(0, rendimentoTributavel - deducoes);

  const faixa = tabelaIrrf.find((f) => f.ate === null || baseIrrf <= f.ate);
  const valorIrrf = Math.max(0, baseIrrf * faixa.aliquota - faixa.parcela_deduzir);

  return { baseIrrf: round2(baseIrrf), valorIrrf: round2(valorIrrf) };
}
