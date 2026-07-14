/**
 * Módulo de UI: orquestra estados visuais (loading/erro/vazio), popula o
 * seletor de ano e conecta os eventos da interface aos demais módulos.
 * Não contém regras de negócio — apenas manipulação de DOM.
 */
import { formatDateTime } from "./utils.js";

const STATE_IDS = ["state-loading", "state-error", "state-empty", "dashboard-content"];

/** Alterna qual "estado" da aplicação está visível (loading, erro, vazio ou conteúdo). */
export function showState(stateId) {
  STATE_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = id !== stateId;
  });
}

/** Exibe a mensagem de erro amigável dentro do estado de erro. */
export function setErrorMessage(message) {
  const el = document.getElementById("error-message");
  if (el) el.textContent = message;
}

/**
 * Popula o seletor de anos, preservando a seleção atual quando possível.
 * @param {number[]} years anos disponíveis, em ordem crescente.
 * @param {number} selectedYear ano que deve ficar selecionado.
 */
export function populateYearSelect(years, selectedYear) {
  const select = document.getElementById("year-select");
  if (!select) return;

  select.innerHTML = "";
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    option.selected = year === selectedYear;
    select.appendChild(option);
  });
}

/** Retorna o ano atualmente selecionado no filtro (ou null se não houver opções). */
export function getSelectedYear() {
  const select = document.getElementById("year-select");
  if (!select || !select.value) return null;
  return Number(select.value);
}

/** Atualiza o rodapé com o horário da última sincronização bem-sucedida. */
export function setLastSyncTime(date) {
  const el = document.getElementById("last-sync-time");
  if (el) el.textContent = formatDateTime(date);
}

/** Habilita/desabilita o botão de atualizar (evita cliques concorrentes). */
export function setRefreshButtonBusy(isBusy) {
  const button = document.getElementById("refresh-button");
  if (!button) return;
  button.disabled = isBusy;
  button.classList.toggle("is-busy", isBusy);
}

/** Registra os handlers de eventos da interface (filtro e botão de atualizar). */
export function bindEvents({ onYearChange, onRefresh }) {
  const select = document.getElementById("year-select");
  const refreshButton = document.getElementById("refresh-button");

  select?.addEventListener("change", (event) => {
    onYearChange(Number(event.target.value));
  });

  refreshButton?.addEventListener("click", () => {
    onRefresh();
  });
}
