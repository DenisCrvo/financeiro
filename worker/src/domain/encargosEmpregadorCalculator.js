// Encargos do Empregador Doméstico — recolhidos mensalmente via Simples
// Doméstico (DAE / eSocial), Lei Complementar 150/2015, art. 24 e 34:
//
//   • INSS Patronal ......... 8,0%  (LC 150/2015, art. 24, I)
//   • RAT (Seguro Acidente) . 0,8%  (Lei 8.212/1991, art. 22-A — alíquota
//                                    FIXA para o empregador doméstico, sem
//                                    variação por grau de risco/FAP como nas
//                                    empresas em geral)
//   • FGTS .................. 8,0%  (Lei 8.036/1990, art. 15)
//   • FGTS indenizatório .... 3,2%  (LC 150/2015, art. 22)
//   ---------------------------------
//   • Total .................. 20,0% sobre a remuneração
//
// Este módulo soma apenas INSS patronal + RAT (os encargos que não são
// depósito de FGTS, já calculados separadamente por fgtsCalculator.js) para
// compor `encargos_empregador`; o total geral do custo patronal é a soma de
// `encargos_empregador` + `valor_fgts` + `valor_fgts_indenizatorio`.
import { round2 } from './money.js';

/**
 * @param {number} remuneracao base de cálculo (mesma base do INSS/FGTS — soma das rubricas com incidência)
 * @param {{percentualInssPatronal:number, percentualRat:number}} aliquotas
 * @returns {{inssPatronal:number, rat:number, total:number}}
 */
export function calcularEncargosEmpregador(remuneracao, { percentualInssPatronal, percentualRat }) {
  const inssPatronal = round2(remuneracao * percentualInssPatronal);
  const rat = round2(remuneracao * percentualRat);
  const total = round2(inssPatronal + rat);

  return { inssPatronal, rat, total };
}
