// FGTS — Fundo de Garantia do Tempo de Serviço.
//
// Base legal: Lei 8.036/1990, art. 15 (depósito mensal de 8% sobre a
// remuneração) e Lei Complementar 150/2015, art. 22 (depósito adicional de
// 3,2% a título de antecipação da indenização compensatória — EXCLUSIVO do
// empregador doméstico, recolhido via eSocial/FGTS Digital, Simples
// Doméstico). Este segundo depósito substitui a multa rescisória paga à
// vista em caso de dispensa sem justa causa: o valor já fica acumulado na
// conta vinculada ao longo do contrato.
import { round2 } from './money.js';

/**
 * @param {number} baseFgts soma das rubricas com incidência de FGTS
 * @param {{percentualFgts:number, percentualFgtsIndenizatorio:number}} aliquotas
 * @returns {{baseFgts:number, valorFgts:number, valorFgtsIndenizatorio:number}}
 */
export function calcularFGTS(baseFgts, { percentualFgts, percentualFgtsIndenizatorio }) {
  const valorFgts = round2(baseFgts * percentualFgts);
  const valorFgtsIndenizatorio = round2(baseFgts * percentualFgtsIndenizatorio);

  return { baseFgts: round2(baseFgts), valorFgts, valorFgtsIndenizatorio };
}
