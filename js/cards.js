/**
 * Módulo de cards: única responsabilidade é calcular e renderizar
 * os indicadores de topo (cartões).
 */
import { CONFIG } from "./config.js";
import { formatCurrencyBR, toTitleCase, normalizeKey } from "./utils.js";

/** Soma os valores de um conjunto de colunas (já normalizadas) em uma entrada. */
function sumColumns(entry, columnNames) {
  return columnNames.reduce((acc, column) => {
    const key = normalizeKey(column);
    return acc + (entry?.valores?.[key] ?? 0);
  }, 0);
}

/**
 * Atualiza o card "Total Cartões (Próximo mês)" com a soma das colunas
 * configuradas em CONFIG.CARD_COLUMNS.TOTAL_CARTOES.
 * @param {object|null} nextEntry entrada do próximo mês disponível.
 */
function renderTotalCartoes(nextEntry) {
  const valueEl = document.getElementById("card-total-cartoes-value");
  const labelEl = document.getElementById("card-total-cartoes-month");
  if (!valueEl || !labelEl) return;

  if (!nextEntry) {
    valueEl.textContent = formatCurrencyBR(0);
    labelEl.textContent = "Sem dados disponíveis";
    return;
  }

  const total = sumColumns(nextEntry, CONFIG.CARD_COLUMNS.TOTAL_CARTOES);
  valueEl.textContent = formatCurrencyBR(total);
  labelEl.textContent = `${toTitleCase(nextEntry.mes)}/${nextEntry.ano}`;
}

/**
 * Atualiza o card "Outras Despesas (Próximo mês)" com o total do mês
 * excluindo as colunas de cartão (Nubank/Bradesco), que já têm seu próprio
 * card dedicado — evita mostrar o mesmo valor de cartão em dois lugares.
 * @param {object|null} nextEntry entrada do próximo mês disponível.
 */
function renderOutrasDespesas(nextEntry) {
  const valueEl = document.getElementById("card-outras-despesas-value");
  const labelEl = document.getElementById("card-outras-despesas-month");
  if (!valueEl || !labelEl) return;

  if (!nextEntry) {
    valueEl.textContent = formatCurrencyBR(0);
    labelEl.textContent = "Sem dados disponíveis";
    return;
  }

  const totalCartoes = sumColumns(nextEntry, CONFIG.CARD_COLUMNS.TOTAL_CARTOES);
  const outrasDespesas = nextEntry.total - totalCartoes;

  valueEl.textContent = formatCurrencyBR(outrasDespesas);
  labelEl.textContent = `${toTitleCase(nextEntry.mes)}/${nextEntry.ano}`;
}

/**
 * Ponto único de atualização de todos os cards de indicadores.
 * @param {object|null} nextEntry entrada do próximo mês disponível.
 */
export function updateCards(nextEntry) {
  renderTotalCartoes(nextEntry);
  renderOutrasDespesas(nextEntry);
}
