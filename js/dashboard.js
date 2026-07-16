// Orquestração do Dashboard Financeiro (dashboard.html).

import { dashboardApi, auditLogApi } from './api.js';
import { formatCurrencyBRL, populateYearSelect, formatDateTimeBR, monthName } from './utils.js';
import { showToast } from '../components/toast.js';

const CHART_COLOR = '#2a78d6';
const GRID_COLOR = '#e1e0d9';
const INK_MUTED = '#898781';
const INK_SECONDARY = '#52514e';

let chartInstance = null;
let cardsChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  const yearFilter = document.getElementById('dashboard-year-filter');
  populateYearSelect(yearFilter, { rangeBack: 3, rangeForward: 1 });

  yearFilter.addEventListener('change', () => loadDashboard(yearFilter.value));
  document.querySelector('[data-action="toggle-table"]').addEventListener('click', toggleTableView);

  loadDashboard(yearFilter.value);
  loadLastUpdate();
  initHistorySection();
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
    renderCardsChart(data.monthly_totals);
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

function buildMonthlyBarChart(canvas, labels, values, seriesLabel) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: seriesLabel,
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
  chartInstance = buildMonthlyBarChart(canvas, labels, values, 'Despesas totais');
}

function renderCardsChart(monthlyTotals) {
  const canvas = document.getElementById('cards-chart');
  const labels = monthlyTotals.map((m) => m.month_name.slice(0, 3));
  const values = monthlyTotals.map((m) => m.cards_total);

  if (cardsChartInstance) {
    cardsChartInstance.data.labels = labels;
    cardsChartInstance.data.datasets[0].data = values;
    cardsChartInstance.update();
    return;
  }
  cardsChartInstance = buildMonthlyBarChart(canvas, labels, values, 'Total Cartões');
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

// ---------------------------------------------------------------------------
// Histórico de Lançamentos (audit log)
// ---------------------------------------------------------------------------

const TABLE_LABELS = {
  credit_cards: 'Cartão de Crédito',
  employee_monthly: 'Funcionária',
  employee_advances: 'Adiantamento',
  fixed_expenses: 'Despesa Fixa',
};

const OPERATION_LABELS = { INSERT: 'Criado', UPDATE: 'Atualizado', DELETE: 'Removido' };
const OPERATION_BADGE = { INSERT: 'text-bg-success', UPDATE: 'text-bg-warning', DELETE: 'text-bg-danger' };

const FIELD_LABELS = {
  card_name: 'Cartão', year: 'Ano', month: 'Mês', value: 'Valor', previous_value: 'Valor anterior',
  days_worked: 'Dias trabalhados', transport_value: 'Vale Transporte', vacation_value: 'Férias',
  thirteenth_value: '13º', advance_discount_value: 'Desconto Adiantamento', esocial_value: 'E-social',
  discount_value: 'Valor do desconto', description: 'Descrição',
};

const HIDDEN_FIELDS = new Set(['expense_type_id', 'batch_id']);
const CURRENCY_FIELDS = new Set([
  'value', 'previous_value', 'transport_value', 'vacation_value', 'thirteenth_value',
  'advance_discount_value', 'esocial_value', 'discount_value',
]);

function formatFieldValue(field, value) {
  if (value === null || value === undefined) return '—';
  if (CURRENCY_FIELDS.has(field)) return formatCurrencyBRL(value);
  if (field === 'month') return monthName(value);
  return String(value);
}

function formatAuditRecord(record) {
  const oldData = record.old_value ? JSON.parse(record.old_value) : null;
  const newData = record.new_value ? JSON.parse(record.new_value) : null;

  if (record.operation === 'UPDATE' && oldData && newData) {
    const parts = [];
    for (const [field, newVal] of Object.entries(newData)) {
      if (HIDDEN_FIELDS.has(field)) continue;
      const oldVal = oldData[field];
      if (oldVal === newVal) continue;
      const label = FIELD_LABELS[field] ?? field;
      parts.push(`${label}: ${formatFieldValue(field, oldVal)} → ${formatFieldValue(field, newVal)}`);
    }
    return parts.join(' · ') || '—';
  }

  const data = newData ?? oldData ?? {};
  const parts = Object.entries(data)
    .filter(([field]) => !HIDDEN_FIELDS.has(field))
    .map(([field, val]) => `${FIELD_LABELS[field] ?? field}: ${formatFieldValue(field, val)}`);
  return parts.join(' · ') || '—';
}

function initHistorySection() {
  const yearSelect = document.querySelector('[data-history-filter="year"]');
  if (!yearSelect) return;

  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }

  document.querySelectorAll('[data-history-filter]').forEach((el) => {
    el.addEventListener('change', loadHistory);
  });

  loadHistory();
}

async function loadHistory() {
  const tbody = document.querySelector('[data-table="history-list"]');
  const infoEl = document.querySelector('[data-history-info]');
  const filters = {
    table: document.querySelector('[data-history-filter="table"]').value || undefined,
    operation: document.querySelector('[data-history-filter="operation"]').value || undefined,
    year: document.querySelector('[data-history-filter="year"]').value || undefined,
  };

  try {
    const records = await auditLogApi.list(filters);
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>';
      infoEl.textContent = '';
      return;
    }
    tbody.innerHTML = records.map((record) => `
      <tr>
        <td class="text-nowrap">${formatDateTimeBR(record.changed_at).full}</td>
        <td>${TABLE_LABELS[record.table_name] ?? record.table_name}</td>
        <td><span class="badge ${OPERATION_BADGE[record.operation] ?? 'text-bg-secondary'}">${OPERATION_LABELS[record.operation] ?? record.operation}</span></td>
        <td class="small">${formatAuditRecord(record)}</td>
      </tr>
    `).join('');
    infoEl.textContent = `${records.length} registro(s) exibido(s)${records.length >= 200 ? ' (limite de 200 atingido — refine os filtros)' : ''}.`;
  } catch (err) {
    showToast(err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Erro ao carregar o histórico.</td></tr>';
  }
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
