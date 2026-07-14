/**
 * Módulo de gráficos: única responsabilidade é desenhar o gráfico principal
 * usando Google Charts. Não busca nem processa dados de negócio.
 */
import { CONFIG } from "./config.js";
import { formatCurrencyBR, toTitleCase } from "./utils.js";

let googleChartsReady = null;
let currentChart = null;
let currentDataTable = null;
let currentOptions = null;
let lastContainerId = null;
let lastMonthlyEntries = null;

/**
 * Carrega a biblioteca Google Charts (uma única vez) e resolve quando
 * o pacote "corechart" estiver pronto para uso.
 * @returns {Promise<void>}
 */
export function initGoogleCharts() {
  if (googleChartsReady) return googleChartsReady;

  googleChartsReady = new Promise((resolve, reject) => {
    if (typeof google === "undefined" || !google.charts) {
      reject(new Error("Biblioteca Google Charts não foi carregada."));
      return;
    }
    google.charts.load("current", { packages: ["corechart"] });
    google.charts.setOnLoadCallback(resolve);
  });

  return googleChartsReady;
}

/** Abaixo desta largura de container (px), os rótulos dos meses são inclinados
 *  e a fonte é reduzida para caberem sem sobrepor no gráfico de barras verticais. */
const MOBILE_BREAKPOINT_PX = 480;

/**
 * Desenha o gráfico de barras verticais (colunas) com o total de cada mês.
 * @param {string} containerId id do elemento onde o gráfico será renderizado.
 * @param {Array<{mes: string, total: number}>} monthlyEntries entradas já ordenadas por mês.
 */
export function drawMainChart(containerId, monthlyEntries) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const dataTable = new google.visualization.DataTable();
  dataTable.addColumn("string", "Mês");
  dataTable.addColumn("number", "Total");
  dataTable.addColumn({ type: "string", role: "tooltip" });

  monthlyEntries.forEach((entry) => {
    const label = toTitleCase(entry.mes);
    const tooltip = `${label}/${entry.ano}: ${formatCurrencyBR(entry.total)}`;
    dataTable.addRow([label, entry.total, tooltip]);
  });

  // Formata a coluna de valores como moeda brasileira (eixo e rótulos das barras).
  const currencyFormatter = new google.visualization.NumberFormat({
    prefix: "R$ ",
    decimalSymbol: ",",
    groupingSymbol: ".",
    fractionDigits: 2,
  });
  currencyFormatter.format(dataTable, 1);

  const isMobile = container.clientWidth > 0 && container.clientWidth < MOBILE_BREAKPOINT_PX;

  const options = {
    legend: { position: "none" },
    animation: {
      duration: 500,
      easing: "out",
      startup: true,
    },
    colors: [CONFIG.CHART_COLORS.bar],
    chartArea: {
      left: isMobile ? 60 : 90,
      top: 20,
      right: 20,
      bottom: isMobile ? 90 : 60,
    },
    hAxis: {
      textStyle: {
        color: CONFIG.CHART_COLORS.text,
        fontSize: isMobile ? 10 : 12,
      },
      slantedText: true,
      slantedTextAngle: isMobile ? 60 : 30,
      gridlines: { color: "transparent" },
    },
    vAxis: {
      textStyle: { color: CONFIG.CHART_COLORS.text, fontSize: isMobile ? 10 : 12 },
      gridlines: { color: "#EEF0F5" },
      minValue: 0,
    },
    tooltip: { isHtml: false },
    fontName: "inherit",
    backgroundColor: "transparent",
  };

  currentChart = new google.visualization.ColumnChart(container);
  currentDataTable = dataTable;
  currentOptions = options;
  lastContainerId = containerId;
  lastMonthlyEntries = monthlyEntries;
  currentChart.draw(currentDataTable, currentOptions);
}

/**
 * Redesenha o último gráfico renderizado (útil em resize da janela).
 * Chama drawMainChart novamente em vez de reusar as options antigas, pois o
 * layout (rótulos inclinados, margens, tamanho de fonte) depende da largura
 * atual do container e precisa ser recalculado ao cruzar o breakpoint mobile.
 */
export function redrawCurrentChart() {
  if (lastContainerId && lastMonthlyEntries) {
    drawMainChart(lastContainerId, lastMonthlyEntries);
  }
}
