// Vale-Transporte — Lei nº 7.418/1985, art. 4º, c/c Decreto nº 95.247/1987,
// art. 32.
//
// O VT é um BENEFÍCIO (auxílio-transporte), não uma verba salarial: por
// determinação legal expressa, não integra remuneração, não incide INSS,
// IRRF nem FGTS, e não é considerado para nenhuma outra base de cálculo
// (art. 2º, §único, Decreto 95.247/1987 e art. 4º, Lei 7.418/1985).
//
// IMPORTANTE (base legal do desconto): o art. 32 do Decreto 95.247/1987
// fixa o limite da participação do empregado em até 6% do "salário básico"
// — não do salário bruto/remuneração total. Por isso este cálculo usa
// `salarioBase` (o campo salario_base da folha) como base do limite legal,
// e não o salário bruto (que inclui horas extras, adicionais etc.).
import { round2 } from './money.js';

/**
 * @param {{diasUteis:number, valorPassagemDia:number, percentualDesconto:number, salarioBase:number}} params
 * @returns {{valorVtDepositado:number, limiteLegal:number, descontoVt:number, custoEmpregador:number}}
 */
export function calcularValeTransporte({ diasUteis, valorPassagemDia, percentualDesconto, salarioBase }) {
  const valorVtDepositado = round2(diasUteis * valorPassagemDia);
  const limiteLegal = round2(salarioBase * percentualDesconto);
  const descontoVt = round2(Math.min(valorVtDepositado, limiteLegal));
  const custoEmpregador = round2(valorVtDepositado - descontoVt);

  return { valorVtDepositado, limiteLegal, descontoVt, custoEmpregador };
}
