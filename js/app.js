// Orquestração da tela de Cadastro de Despesas (index.html).
// Liga os formulários da interface aos serviços de negócio e à API.

import { creditCardsApi, employeeApi, advancesApi, expenseTypesApi, fixedExpensesApi } from './api.js';
import {
  formatCurrencyBRL, attachCurrencyMask, getCurrencyInputValue,
  populateYearSelect, populateMonthSelect, monthName, MONTH_NAMES_PT,
} from './utils.js';
import { showToast } from '../components/toast.js';
import { confirmModal, newExpenseTypeModal, manageExpenseTypesModal } from '../components/modal.js';
import {
  calculateTransportValue, validateCreditCardForm, validateEmployeeForm,
  validateFixedExpenseForm, validateAdvanceForm,
} from '../services/financeiroService.js';

const CARD_LABELS = { bradesco: 'Bradesco', nubank: 'Nubank' };

document.addEventListener('DOMContentLoaded', () => {
  initCreditCardsSection();
  initEmployeeSection();
  initFixedExpensesSection();
  initAdvancesSection();
});

// ---------------------------------------------------------------------------
// Helpers compartilhados
// ---------------------------------------------------------------------------

function renderConflictBox(conflictBox, lastValue, { onUpdate, onKeep }) {
  conflictBox.classList.remove('d-none');
  conflictBox.innerHTML = `
    Último valor registrado: <strong>${formatCurrencyBRL(lastValue)}</strong>
    <div class="d-flex gap-2 mt-2">
      <button type="button" class="btn btn-sm btn-warning" data-action="update">Atualizar valor</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="keep">Manter lançamento anterior</button>
    </div>
  `;
  conflictBox.querySelector('[data-action="keep"]').addEventListener('click', () => {
    conflictBox.classList.add('d-none');
    conflictBox.innerHTML = '';
    onKeep?.();
  });
  conflictBox.querySelector('[data-action="update"]').addEventListener('click', onUpdate);
}

function hideConflictBox(conflictBox) {
  conflictBox.classList.add('d-none');
  conflictBox.innerHTML = '';
}

// ---------------------------------------------------------------------------
// Sessão 1 — Cartões de Crédito
// ---------------------------------------------------------------------------

function initCreditCardsSection() {
  document.querySelectorAll('[data-form="credit-card"]').forEach((form) => {
    const yearSelect = form.querySelector('[data-field="year"]');
    const monthSelect = form.querySelector('[data-field="month"]');
    const valueInput = form.querySelector('[data-field="value"]');
    populateYearSelect(yearSelect);
    populateMonthSelect(monthSelect);
    attachCurrencyMask(valueInput);

    form.addEventListener('submit', (e) => handleCreditCardSubmit(e, form));
  });
}

async function handleCreditCardSubmit(e, form) {
  e.preventDefault();
  const cardName = form.dataset.cardName;
  const year = Number(form.querySelector('[data-field="year"]').value);
  const month = Number(form.querySelector('[data-field="month"]').value);
  const valueInput = form.querySelector('[data-field="value"]');
  const value = getCurrencyInputValue(valueInput);
  const conflictBox = form.querySelector('[data-conflict-box]');
  hideConflictBox(conflictBox);

  const errors = validateCreditCardForm({ year, month, value });
  if (errors.length) { showToast(errors[0], 'warning'); return; }

  try {
    const check = await creditCardsApi.check(cardName, year, month);

    if (check.exists) {
      renderConflictBox(conflictBox, check.record.value, {
        onUpdate: async () => {
          const confirmed = await confirmModal({
            title: 'Confirmar atualização de fatura?',
            rows: [
              ['Cartão', CARD_LABELS[cardName]],
              ['Ano', String(year)],
              ['Mês', monthName(month)],
              ['Valor anterior', formatCurrencyBRL(check.record.value)],
              ['Novo valor', formatCurrencyBRL(value)],
            ],
          });
          if (!confirmed) return;
          await creditCardsApi.update(check.record.id, { value });
          showToast('Fatura atualizada com sucesso.', 'success');
          hideConflictBox(conflictBox);
          valueInput.value = '';
        },
      });
      return;
    }

    const confirmed = await confirmModal({
      title: 'Confirmar lançamento de fatura?',
      rows: [
        ['Cartão', CARD_LABELS[cardName]],
        ['Ano', String(year)],
        ['Mês', monthName(month)],
        ['Valor', formatCurrencyBRL(value)],
      ],
    });
    if (!confirmed) return;

    await creditCardsApi.create({ card_name: cardName, year, month, value });
    showToast(`Fatura ${CARD_LABELS[cardName]} cadastrada com sucesso.`, 'success');
    valueInput.value = '';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Sessão 2 — Funcionária
// ---------------------------------------------------------------------------

function initEmployeeSection() {
  const form = document.querySelector('[data-form="employee"]');
  if (!form) return;

  populateYearSelect(form.querySelector('[data-field="year"]'));
  populateMonthSelect(form.querySelector('[data-field="month"]'));

  ['daily_transport_value', 'vacation_value', 'thirteenth_value', 'advance_discount_value', 'esocial_value']
    .forEach((field) => attachCurrencyMask(form.querySelector(`[data-field="${field}"]`)));

  const daysInput = form.querySelector('[data-field="days_worked"]');
  const dailyInput = form.querySelector('[data-field="daily_transport_value"]');
  const computedEl = form.querySelector('[data-computed="transport_value"]');

  const updateTransportValue = () => {
    const days = Number(daysInput.value) || 0;
    const daily = getCurrencyInputValue(dailyInput);
    computedEl.textContent = formatCurrencyBRL(calculateTransportValue(days, daily));
  };
  daysInput.addEventListener('input', updateTransportValue);
  dailyInput.addEventListener('input', updateTransportValue);

  form.addEventListener('submit', (e) => handleEmployeeSubmit(e, form));
}

async function handleEmployeeSubmit(e, form) {
  e.preventDefault();
  const year = Number(form.querySelector('[data-field="year"]').value);
  const month = Number(form.querySelector('[data-field="month"]').value);
  const daysWorked = Number(form.querySelector('[data-field="days_worked"]').value) || 0;
  const dailyTransportValue = getCurrencyInputValue(form.querySelector('[data-field="daily_transport_value"]'));
  const transportValue = calculateTransportValue(daysWorked, dailyTransportValue);
  const vacationValue = getCurrencyInputValue(form.querySelector('[data-field="vacation_value"]'));
  const thirteenthValue = getCurrencyInputValue(form.querySelector('[data-field="thirteenth_value"]'));
  const advanceDiscountValue = getCurrencyInputValue(form.querySelector('[data-field="advance_discount_value"]'));
  const advanceDiscountMonths = Number(form.querySelector('[data-field="advance_discount_months"]').value) || 0;
  const esocialValue = getCurrencyInputValue(form.querySelector('[data-field="esocial_value"]'));
  const conflictBox = form.querySelector('[data-conflict-box]');
  hideConflictBox(conflictBox);

  const errors = validateEmployeeForm({ year, month, days_worked: daysWorked, daily_transport_value: dailyTransportValue });
  if (errors.length) { showToast(errors[0], 'warning'); return; }

  const payload = {
    year, month, days_worked: daysWorked, daily_transport_value: dailyTransportValue,
    transport_value: transportValue, vacation_value: vacationValue, thirteenth_value: thirteenthValue,
    advance_discount_value: advanceDiscountValue, advance_discount_months: advanceDiscountMonths,
    esocial_value: esocialValue,
  };

  const summaryRows = [
    ['Ano', String(year)], ['Mês', monthName(month)],
    ['Dias trabalhados', String(daysWorked)],
    ['Vale Transporte', formatCurrencyBRL(transportValue)],
    ['Férias', formatCurrencyBRL(vacationValue)],
    ['Décimo Terceiro', formatCurrencyBRL(thirteenthValue)],
    ['Desconto Adiantamento', formatCurrencyBRL(advanceDiscountValue)],
    ['Guia E-social', formatCurrencyBRL(esocialValue)],
  ];

  try {
    const check = await employeeApi.check(year, month);

    if (check.exists) {
      renderConflictBox(conflictBox, check.record.transport_value, {
        onUpdate: async () => {
          const confirmed = await confirmModal({ title: 'Confirmar atualização do lançamento?', rows: summaryRows });
          if (!confirmed) return;
          await employeeApi.update(check.record.id, payload);
          showToast('Lançamento da funcionária atualizado com sucesso.', 'success');
          hideConflictBox(conflictBox);
          form.reset();
        },
      });
      return;
    }

    const confirmed = await confirmModal({ title: 'Confirmar lançamento da funcionária?', rows: summaryRows });
    if (!confirmed) return;

    await employeeApi.create(payload);
    showToast('Lançamento da funcionária cadastrado com sucesso.', 'success');
    form.reset();
    populateYearSelect(form.querySelector('[data-field="year"]'));
    populateMonthSelect(form.querySelector('[data-field="month"]'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Sessão 3 — Despesas Fixas
// ---------------------------------------------------------------------------

function renderMonthCheckboxes(container, idPrefix = 'month') {
  container.innerHTML = MONTH_NAMES_PT.map((name, index) => {
    const month = index + 1;
    const id = `${idPrefix}-${month}`;
    return `
      <div>
        <input type="checkbox" class="btn-check" id="${id}" value="${month}">
        <label class="btn btn-outline-primary btn-sm month-checkbox" for="${id}">${name.slice(0, 3)}</label>
      </div>
    `;
  }).join('');
}

async function loadExpenseTypesIntoSelect(select) {
  const types = await expenseTypesApi.list();
  const previousValue = select.value;
  select.innerHTML = '<option value="" disabled selected>Selecione...</option>' +
    types.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
  if (previousValue && types.some((t) => String(t.id) === previousValue)) select.value = previousValue;
  return types;
}

function initFixedExpensesSection() {
  const form = document.querySelector('[data-form="fixed-expense"]');
  if (!form) return;

  const typeSelect = form.querySelector('[data-field="expense_type_id"]');
  const yearSelect = form.querySelector('[data-field="year"]');
  const valueInput = form.querySelector('[data-field="value"]');
  const monthsContainer = form.querySelector('[data-months-checkboxes]');

  populateYearSelect(yearSelect);
  attachCurrencyMask(valueInput);
  renderMonthCheckboxes(monthsContainer, 'fx-month');
  loadExpenseTypesIntoSelect(typeSelect).catch((err) => showToast(err.message, 'error'));

  form.querySelector('[data-action="new-expense-type"]').addEventListener('click', async () => {
    const name = await newExpenseTypeModal();
    if (!name) return;
    try {
      const created = await expenseTypesApi.create({ name });
      await loadExpenseTypesIntoSelect(typeSelect);
      typeSelect.value = String(created.id);
      showToast('Tipo de despesa cadastrado com sucesso.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  form.querySelector('[data-action="manage-expense-types"]').addEventListener('click', async () => {
    let types;
    try {
      types = await expenseTypesApi.list();
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
    await manageExpenseTypesModal(types, {
      onRename: (id, name) => expenseTypesApi.update(id, { name }),
      onDelete: (id) => expenseTypesApi.remove(id),
    });
    await loadExpenseTypesIntoSelect(typeSelect);
  });

  form.addEventListener('submit', (e) => handleFixedExpenseSubmit(e, form, typeSelect, monthsContainer));
}

async function handleFixedExpenseSubmit(e, form, typeSelect, monthsContainer) {
  e.preventDefault();
  const expenseTypeId = typeSelect.value;
  const year = Number(form.querySelector('[data-field="year"]').value);
  const value = getCurrencyInputValue(form.querySelector('[data-field="value"]'));
  const description = form.querySelector('[data-field="description"]').value.trim();
  const months = Array.from(monthsContainer.querySelectorAll('input:checked')).map((cb) => Number(cb.value));

  const errors = validateFixedExpenseForm({ expense_type_id: expenseTypeId, year, months, value });
  if (errors.length) { showToast(errors[0], 'warning'); return; }

  const typeLabel = typeSelect.options[typeSelect.selectedIndex]?.textContent ?? '';
  const monthsLabel = months.map((m) => monthName(m)).join(', ');

  const confirmed = await confirmModal({
    title: 'Confirmar lançamento de despesa fixa?',
    rows: [
      ['Categoria', typeLabel], ['Ano', String(year)], ['Meses', monthsLabel],
      ['Valor (por mês)', formatCurrencyBRL(value)], ['Descrição', description || '—'],
    ],
  });
  if (!confirmed) return;

  try {
    await fixedExpensesApi.create({ expense_type_id: Number(expenseTypeId), year, months, value, description: description || null });
    showToast('Despesa fixa cadastrada com sucesso.', 'success');
    form.reset();
    renderMonthCheckboxes(monthsContainer, 'fx-month');
    populateYearSelect(form.querySelector('[data-field="year"]'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Controle de Adiantamentos
// ---------------------------------------------------------------------------

function initAdvancesSection() {
  const filterYear = document.querySelector('[data-field="advances-filter-year"]');
  const form = document.querySelector('[data-form="advance"]');
  if (!filterYear || !form) return;

  const yearSelect = form.querySelector('[data-field="year"]');
  const monthsContainer = form.querySelector('[data-months-checkboxes]');

  populateYearSelect(filterYear);
  populateYearSelect(yearSelect);
  attachCurrencyMask(form.querySelector('[data-field="value"]'));
  renderMonthCheckboxes(monthsContainer, 'adv-month');

  filterYear.addEventListener('change', () => refreshAdvances(filterYear.value));
  form.addEventListener('submit', (e) => handleAdvanceSubmit(e, form, filterYear, monthsContainer));

  refreshAdvances(filterYear.value);
}

async function refreshAdvances(year) {
  try {
    const [summary, list] = await Promise.all([advancesApi.summary(year), advancesApi.list(year)]);
    document.querySelector('[data-summary="total_borrowed"]').textContent = formatCurrencyBRL(summary.total_borrowed);
    document.querySelector('[data-summary="total_discounted"]').textContent = formatCurrencyBRL(summary.total_discounted);
    document.querySelector('[data-summary="total_remaining"]').textContent = formatCurrencyBRL(summary.total_remaining);
    renderAdvancesTable(list);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function isMonthPastOrCurrent(year, month) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year < currentYear || (year === currentYear && month <= currentMonth);
}

function renderAdvancesTable(list) {
  const tbody = document.querySelector('[data-table="advances-list"]');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">Nenhum desconto cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((advance) => {
    const discounted = isMonthPastOrCurrent(advance.year, advance.month);
    const statusBadge = discounted
      ? '<span class="badge text-bg-secondary">Descontado</span>'
      : '<span class="badge text-bg-warning">Pendente</span>';
    return `
    <tr>
      <td>${monthName(advance.month)}/${advance.year}</td>
      <td>${formatCurrencyBRL(advance.discount_value)}</td>
      <td>${statusBadge}</td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-advance" data-id="${advance.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `;
  }).join('');

  tbody.querySelectorAll('[data-action="delete-advance"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remover este desconto do cronograma?')) return;
      try {
        await advancesApi.remove(btn.dataset.id);
        showToast('Desconto removido.', 'success');
        const filterYear = document.querySelector('[data-field="advances-filter-year"]');
        refreshAdvances(filterYear.value);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

async function handleAdvanceSubmit(e, form, filterYear, monthsContainer) {
  e.preventDefault();
  const value = getCurrencyInputValue(form.querySelector('[data-field="value"]'));
  const year = Number(form.querySelector('[data-field="year"]').value);
  const months = Array.from(monthsContainer.querySelectorAll('input:checked')).map((cb) => Number(cb.value));

  const errors = validateAdvanceForm({ value, year, months });
  if (errors.length) { showToast(errors[0], 'warning'); return; }

  const monthsLabel = months.map((m) => monthName(m)).join(', ');
  const confirmed = await confirmModal({
    title: 'Confirmar cronograma de desconto de adiantamento?',
    rows: [
      ['Valor do desconto (por mês)', formatCurrencyBRL(value)],
      ['Ano', String(year)],
      ['Meses', monthsLabel],
    ],
  });
  if (!confirmed) return;

  try {
    await advancesApi.create({ value, year, months });
    showToast('Cronograma de desconto cadastrado com sucesso.', 'success');
    form.reset();
    renderMonthCheckboxes(monthsContainer, 'adv-month');
    populateYearSelect(form.querySelector('[data-field="year"]'));
    await refreshAdvances(filterYear.value);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
