// Arredondamento monetário padrão (2 casas decimais) usado por todo o motor
// de cálculo da folha, evitando erros de ponto flutuante (ex.: 0.1 + 0.2).
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
