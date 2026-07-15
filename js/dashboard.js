// Orquestração do Dashboard Financeiro (dashboard.html).

import { dashboardApi } from './api.js';
import { formatCurrencyBRL, populateYearSelect, formatDateTimeBR } from './utils.js';
import { showToast } from '../components/toast.js';

const CHART_COLOR = '#2a78d6';
const GRID_COLOR = '#e1e0d9';
const INK_MUTED = '#898781';
const INK_SECONDARY = '#52514e';

let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  const yearFilter = document.getElementById('dashboard-year-filter');
  populateYearSelect(yearFilter, { rangeBack: 3, rangeForward: 1 });

  yearFilter.addEventListener('change', () => loadDashboard(yearFilter.value));
  document.querySelector('[data-action="toggle-table"]').addEventListener('click', toggleTableView);

  loadDashboard(yearFilter.value);
  loadLastUpdate();
});

function compactCurrency(value) {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return formatCurrencyBRL(value);
  }
}

async function loadDashboard(year) {
  try {
    const data = await dashboardApi.get(year);
    renderCards(data);
    renderChart(data.monthly_totals);
    renderTable(data.monthly_totals);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCards(data) {
  const cardsTotalEl = document.querySelector('[data-card="cards-total"]');
  const cardsPeriodEl = document.querySelector('[data-card="cards-total-period"]');
  const otherTotalEl = document.querySelector('[data-card="other-total"]');
  const otherPeriodEl = document.querySelector('[data-card="other-total-period"]');

  [cardsTotalEl, otherTotalEl].forEach((el) => el.classList.remove('skeleton'));

  cardsTotalEl.textContent = formatCurrencyBRL(data.cards_total_next_month);
  cardsPeriodEl.textContent = `${data.next_month.month_name}/${data.next_month.year}`;
  otherTotalEl.textContent = formatCurrencyBRL(data.other_expenses_total_next_month);
  otherPeriodEl.textContent = `${data.next_month.month_name}/${data.next_month.year}`;
}

function renderChart(monthlyTotals) {
  const canvas = document.getElementById('monthly-chart');
  const labels = monthlyTotals.map((m) => m.month_name.slice(0, 3));
  const values = monthlyTotals.map((m) => m.total);

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = values;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Despesas totais',
        data: values,
        backgroundColor: CHART_COLOR,
        borderRadius: 4,
        maxBarThickness: 24,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatCurrencyBRL(context.parsed.y),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: INK_SECONDARY },
        },
        y: {
          beginAtZero: true,
          grid: { color: GRID_COLOR, drawTicks: false },
          border: { display: false },
          ticks: {
            color: INK_MUTED,
            callback: (value) => compactCurrency(value),
          },
        },
      },
    },
  });
}

function renderTable(monthlyTotals) {
  const tbody = document.querySelector('[data-table="monthly-totals"]');
  tbody.innerHTML = monthlyTotals.map((m) => `
    <tr>
      <td>${m.month_name}</td>
      <td class="text-end">${formatCurrencyBRL(m.total)}</td>
    </tr>
  `).join('');
}

function toggleTableView() {
  const chartWrapper = document.querySelector('[data-chart-wrapper]');
  const tableWrapper = document.querySelector('[data-table-wrapper]');
  const btn = document.querySelector('[data-action="toggle-table"]');
  const showingTable = !tableWrapper.classList.contains('d-none');

  chartWrapper.classList.toggle('d-none', !showingTable);
  tableWrapper.classList.toggle('d-none', showingTable);
  btn.innerHTML = showingTable
    ? '<i class="bi bi-table me-1"></i>Ver como tabela'
    : '<i class="bi bi-bar-chart-line me-1"></i>Ver como gráfico';
}

async function loadLastUpdate() {
  try {
    const { last_update } = await dashboardApi.lastUpdate();
    document.querySelector('[data-last-update]').textContent = last_update
      ? formatDateTimeBR(last_update).full
      : 'Nenhum lançamento registrado ainda.';
  } catch (err) {
    document.querySelector('[data-last-update]').textContent = 'Indisponível.';
  }
}
