/**
 * Configuração central da aplicação.
 * Qualquer ajuste de fonte de dados, locale ou nomes de colunas deve ser feito aqui.
 */
export const CONFIG = Object.freeze({
  // Endpoint CSV da planilha publicada (aba "Geral").
  CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdmmtoz98T2qiej5INbkx63Vcla6nvqM6XtDMqyn0NfXvfSy6_p5X2lK95n6UNGHchv_eiIAvigO7n/pub?output=csv&gid=0",

  LOCALE: "pt-BR",
  CURRENCY: "BRL",

  // Nomes das colunas fixas de identificação (não entram na soma financeira).
  IDENTIFIER_COLUMNS: ["ANO", "MES"],

  // Colunas usadas no card de cartões. O card de "outras despesas" usa o
  // total do mês subtraindo essas mesmas colunas.
  CARD_COLUMNS: {
    TOTAL_CARTOES: ["NUBANK", "BRADESCO"],
  },

  // Meses na ordem do calendário, exatamente como aparecem na planilha (maiúsculo, com acento).
  MONTHS: [
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
  ],

  CHART_COLORS: {
    bar: "#4C6FFF",
    barHover: "#3454E0",
    text: "#1F2430",
  },
});
