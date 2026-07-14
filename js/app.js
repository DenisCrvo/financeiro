/**
 * Ponto de entrada da aplicação: inicializa módulos e conecta eventos.
 * Nenhuma regra de negócio deve viver aqui — apenas orquestração.
 */
import {
  loadDataset,
  getAvailableYears,
  filterByYear,
  getNextMonthEntry,
} from "./data.js";
import { initGoogleCharts, drawMainChart, redrawCurrentChart } from "./charts.js";
import { updateCards } from "./cards.js";
import {
  showState,
  setErrorMessage,
  populateYearSelect,
  getSelectedYear,
  setLastSyncTime,
  setRefreshButtonBusy,
  bindEvents,
} from "./ui.js";

const MAIN_CHART_CONTAINER_ID = "main-chart";

/** Renderiza gráfico e cards para o ano informado, a partir do dataset em memória. */
function renderYear(dataset, year) {
  const yearEntries = filterByYear(dataset, year);
  drawMainChart(MAIN_CHART_CONTAINER_ID, yearEntries);

  const nextEntry = getNextMonthEntry(dataset);
  updateCards(nextEntry);
}

/**
 * Carrega (ou recarrega) os dados e atualiza toda a interface.
 * @param {boolean} forceRefresh ignora o cache em memória e busca a planilha novamente.
 */
async function loadAndRender(forceRefresh) {
  try {
    setRefreshButtonBusy(true);
    if (!forceRefresh) showState("state-loading");

    const dataset = await loadDataset(forceRefresh);
    const years = getAvailableYears(dataset);

    if (years.length === 0) {
      showState("state-empty");
      return;
    }

    const previousSelection = getSelectedYear();
    const currentYear = new Date().getFullYear();
    const selectedYear = years.includes(previousSelection)
      ? previousSelection
      : years.includes(currentYear)
        ? currentYear
        : years[years.length - 1];

    populateYearSelect(years, selectedYear);

    // O painel precisa estar visível (largura real, não 0) antes de desenhar
    // o gráfico — o Google Charts calcula o tamanho a partir do container no
    // momento do draw() e não se ajusta sozinho depois que ele aparece.
    showState("dashboard-content");
    renderYear(dataset, selectedYear);
    setLastSyncTime(new Date());
  } catch (error) {
    setErrorMessage(error.message || "Ocorreu um erro inesperado ao carregar os dados.");
    showState("state-error");
  } finally {
    setRefreshButtonBusy(false);
  }
}

/** Reage à troca de ano no filtro, redesenhando apenas o gráfico e os cards. */
async function handleYearChange(year) {
  const dataset = await loadDataset(false);
  renderYear(dataset, year);
}

/** Reage ao clique em "Atualizar Dados", buscando a planilha novamente. */
function handleRefresh() {
  loadAndRender(true);
}

/** Inicializa a aplicação assim que o DOM e o Google Charts estiverem prontos. */
async function init() {
  bindEvents({ onYearChange: handleYearChange, onRefresh: handleRefresh });

  try {
    await initGoogleCharts();
  } catch (error) {
    setErrorMessage("Não foi possível carregar a biblioteca de gráficos.");
    showState("state-error");
    return;
  }

  window.addEventListener("resize", debounce(redrawCurrentChart, 250));

  await loadAndRender(false);
}

/** Debounce simples para evitar redesenhos excessivos do gráfico no resize. */
function debounce(fn, delayMs) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

document.addEventListener("DOMContentLoaded", init);
