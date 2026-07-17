// INSS — Contribuição do segurado empregado/empregado doméstico.
//
// Base legal: Lei 8.212/1991, art. 20 (com redação dada pela Lei 13.982/2020)
// e Emenda Constitucional nº 103/2019, que unificou o regime de cálculo por
// FAIXAS PROGRESSIVAS (cada faixa tributada à sua própria alíquota, com o
// valor somado ao final), substituindo o método anterior de alíquota única
// sobre o valor total. Este é o mesmo método usado para o trabalhador
// doméstico, já que a Lei Complementar 150/2015, art. 20, remete à tabela
// geral de contribuição do RGPS.
//
// O teto de contribuição (Art. 28, §5º, Lei 8.212/1991) limita a base:
// remunerações acima do teto contribuem apenas até o teto.
import { round2 } from './money.js';

/**
 * @param {number} baseInss valor sobre o qual incide o INSS (soma das rubricas com incidência INSS)
 * @param {Array<{ate:number, aliquota:number}>} tabelaInss faixas em ordem crescente
 * @param {number} tetoInss teto do salário de contribuição da competência
 * @returns {{baseInss:number, valorInss:number}}
 */
export function calcularINSS(baseInss, tabelaInss, tetoInss) {
  const baseContribuicao = Math.min(Number(baseInss), Number(tetoInss));

  let valorInss = 0;
  let limiteAnterior = 0;
  for (const faixa of tabelaInss) {
    if (baseContribuicao <= limiteAnterior) break;
    const tetoFaixa = Math.min(baseContribuicao, faixa.ate);
    const baseNaFaixa = tetoFaixa - limiteAnterior;
    valorInss += baseNaFaixa * faixa.aliquota;
    limiteAnterior = faixa.ate;
  }

  return { baseInss: round2(baseContribuicao), valorInss: round2(valorInss) };
}
