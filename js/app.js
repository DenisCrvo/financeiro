// Orquestração da tela de Cadastro de Despesas (index.html).
// Liga os formulários da interface aos serviços de negócio e à API.

import {
  creditCardsApi, expenseTypesApi, fixedExpensesApi,
  funcionariaExpenseTypesApi, funcionariaPaymentsApi,
} from './api.js';
import {
  formatCurrencyBRL, attachCurrencyMask, getCurrencyInputValue,
  populateYearSelect, populateMonthSelect, monthName, MONTH_NAMES_PT,
} from './utils.js';
import { showToast } from '../components/toast.js';
import {
  confirmModal, newExpenseTypeModal, manageExpenseTypesModal, editRecordModal,
} from '../components/modal.js';
import {
  validateCreditCardForm, validateFixedExpenseForm,
  validateFuncionariaPaymentForm, calcularValeTransporte,
} from '../services/financeiroService.js';

const CARD_LABELS = { bradesco: 'Bradesco', nubank: 'Nubank' };

document.addEventListener('DOMContentLoaded', () => {
  initCreditCardsSection();
  initFixedExpensesSection();
  initFuncionariaPaymentSection();
  initQuerySection();
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
          refreshQueryResults();
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
    refreshQueryResults();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Sessão 2 — Despesas Fixas
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

async function loadExpenseTypesIntoSelect(select, api = expenseTypesApi) {
  const types = await api.list();
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
    refreshQueryResults();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Funcionária — Pagamento Mensal (Vale-Transporte)
// ---------------------------------------------------------------------------

function initFuncionariaPaymentSection() {
  const form = document.querySelector('[data-form="funcionaria-payment"]');
  if (!form) return;

  const typeSelect = form.querySelector('[data-field="expense_type_id"]');
  const yearSelect = form.querySelector('[data-field="year"]');
  const valorPassagemInput = form.querySelector('[data-field="valor_passagem_dia"]');
  const diasUteisInput = form.querySelector('[data-field="dias_uteis"]');
  const monthsContainer = form.querySelector('[data-months-checkboxes]');

  populateYearSelect(yearSelect);
  attachCurrencyMask(valorPassagemInput);
  renderMonthCheckboxes(monthsContainer, 'fp-month');
  loadExpenseTypesIntoSelect(typeSelect, funcionariaExpenseTypesApi).catch((err) => showToast(err.message, 'error'));

  form.querySelector('[data-action="new-expense-type"]').addEventListener('click', async () => {
    const name = await newExpenseTypeModal();
    if (!name) return;
    try {
      const created = await funcionariaExpenseTypesApi.create({ name });
      await loadExpenseTypesIntoSelect(typeSelect, funcionariaExpenseTypesApi);
      typeSelect.value = String(created.id);
      showToast('Tipo de despesa cadastrado com sucesso.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  form.querySelector('[data-action="manage-expense-types"]').addEventListener('click', async () => {
    let types;
    try {
      types = await funcionariaExpenseTypesApi.list();
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
    await manageExpenseTypesModal(types, {
      onRename: (id, name) => funcionariaExpenseTypesApi.update(id, { name }),
      onDelete: (id) => funcionariaExpenseTypesApi.remove(id),
    });
    await loadExpenseTypesIntoSelect(typeSelect, funcionariaExpenseTypesApi);
  });

  const updateVtPreview = () => {
    const { valorVt } = calcularValeTransporte({
      diasUteis: Number(diasUteisInput.value) || 0,
      valorPassagemDia: getCurrencyInputValue(valorPassagemInput),
    });
    form.querySelector('[data-display="valor-total"]').value = formatCurrencyBRL(valorVt).replace('R$', '').trim();
  };
  [valorPassagemInput, diasUteisInput].forEach((input) => {
    input.addEventListener('input', updateVtPreview);
  });

  form.addEventListener('submit', (e) => handleFuncionariaPaymentSubmit(e, form, typeSelect, monthsContainer, updateVtPreview));
}

async function handleFuncionariaPaymentSubmit(e, form, typeSelect, monthsContainer, updateVtPreview) {
  e.preventDefault();
  const expenseTypeId = typeSelect.value;
  const year = Number(form.querySelector('[data-field="year"]').value);
  const diasUteis = Number(form.querySelector('[data-field="dias_uteis"]').value) || 0;
  const valorPassagemDia = getCurrencyInputValue(form.querySelector('[data-field="valor_passagem_dia"]'));
  const description = form.querySelector('[data-field="description"]').value.trim();
  const months = Array.from(monthsContainer.querySelectorAll('input:checked')).map((cb) => Number(cb.value));

  const errors = validateFuncionariaPaymentForm({ expense_type_id: expenseTypeId, year, months });
  if (errors.length) { showToast(errors[0], 'warning'); return; }

  const { valorVt } = calcularValeTransporte({ diasUteis, valorPassagemDia });
  const typeLabel = typeSelect.options[typeSelect.selectedIndex]?.textContent ?? '';
  const monthsLabel = months.map((m) => monthName(m)).join(', ');

  const confirmed = await confirmModal({
    title: 'Confirmar pagamento à funcionária?',
    rows: [
      ['Tipo de despesa', typeLabel], ['Ano', String(year)], ['Meses', monthsLabel],
      ['Valor Total a Pagar (por mês)', formatCurrencyBRL(valorVt)],
      ['Descrição', description || '—'],
    ],
  });
  if (!confirmed) return;

  try {
    await funcionariaPaymentsApi.create({
      expense_type_id: Number(expenseTypeId), year, months,
      dias_uteis: diasUteis, valor_passagem_dia: valorPassagemDia,
      description: description || null,
    });
    showToast('Pagamento lançado com sucesso.', 'success');
    form.reset();
    renderMonthCheckboxes(monthsContainer, 'fp-month');
    populateYearSelect(form.querySelector('[data-field="year"]'));
    updateVtPreview();
    refreshQueryResults();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Consultar e Editar Lançamentos
// ---------------------------------------------------------------------------

const TABLE_LABELS = { credit_cards: 'Cartão de Crédito', fixed_expenses: 'Despesa Fixa', funcionaria_payments: 'Funcionária' };

function buildEditSpec(tableName, record) {
  if (tableName === 'credit_cards') {
    return {
      title: 'Editar fatura de cartão',
      readOnlyRows: [
        ['Cartão', CARD_LABELS[record.card_name] ?? record.card_name],
        ['Ano', String(record.year)], ['Mês', monthName(record.month)],
      ],
      fields: [{ key: 'value', label: 'Valor da fatura', type: 'currency', value: record.value }],
    };
  }
  if (tableName === 'funcionaria_payments') {
    return {
      title: 'Editar pagamento à funcionária',
      readOnlyRows: [
        ['Categoria', record.expense_type_name ?? '—'],
        ['Ano', String(record.year)], ['Mês', monthName(record.month)],
      ],
      fields: [
        { key: 'dias_uteis', label: 'Dias úteis trabalhados', type: 'number', value: record.dias_uteis },
        { key: 'valor_passagem_dia', label: 'Valor passagem/dia (ida+volta)', type: 'currency', value: record.valor_passagem_dia },
        { key: 'description', label: 'Descrição', type: 'text', value: record.description },
      ],
    };
  }
  return {
    title: 'Editar despesa fixa',
    readOnlyRows: [
      ['Categoria', record.expense_type_name ?? '—'],
      ['Ano', String(record.year)], ['Mês', monthName(record.month)],
    ],
    fields: [
      { key: 'value', label: 'Valor', type: 'currency', value: record.value },
      { key: 'description', label: 'Descrição', type: 'text', value: record.description },
    ],
  };
}

function renderQueryRowDetails(tableName, record) {
  if (tableName === 'credit_cards') {
    return `${CARD_LABELS[record.card_name] ?? record.card_name} — ${formatCurrencyBRL(record.value)}`;
  }
  if (tableName === 'funcionaria_payments') {
    return `${record.expense_type_name ?? '—'} — Vale-Transporte ${formatCurrencyBRL(record.valor_vt)}`;
  }
  const desc = record.description ? ` — ${record.description}` : '';
  return `${record.expense_type_name ?? '—'} — ${formatCurrencyBRL(record.value)}${desc}`;
}

function initQuerySection() {
  const yearSelect = document.querySelector('[data-query-filter="year"]');
  if (!yearSelect) return;

  populateYearSelect(yearSelect);

  const monthSelect = document.querySelector('[data-query-filter="month"]');
  MONTH_NAMES_PT.forEach((name, index) => {
    const opt = document.createElement('option');
    opt.value = String(index + 1);
    opt.textContent = name;
    monthSelect.appendChild(opt);
  });

  document.querySelectorAll('[data-query-filter]').forEach((el) => {
    el.addEventListener('change', refreshQueryResults);
  });

  document.querySelector('[data-table="query-list"]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-query-action]');
    if (!btn) return;
    const { queryAction, tableName, recordId } = btn.dataset;
    if (queryAction === 'edit') handleEditQueryRecord(tableName, Number(recordId));
    if (queryAction === 'delete') handleDeleteQueryRecord(tableName, Number(recordId));
  });

  refreshQueryResults();
}

async function refreshQueryResults() {
  const tbody = document.querySelector('[data-table="query-list"]');
  const infoEl = document.querySelector('[data-query-info]');
  if (!tbody) return;

  const tableFilter = document.querySelector('[data-query-filter="table"]').value;
  const year = document.querySelector('[data-query-filter="year"]').value || undefined;
  const month = document.querySelector('[data-query-filter="month"]').value;

  try {
    const [cards, fixed, funcionaria] = await Promise.all([
      tableFilter && tableFilter !== 'credit_cards' ? [] : creditCardsApi.list(year),
      tableFilter && tableFilter !== 'fixed_expenses' ? [] : fixedExpensesApi.list(year),
      tableFilter && tableFilter !== 'funcionaria_payments' ? [] : funcionariaPaymentsApi.list(year),
    ]);

    let records = [
      ...cards.map((r) => ({ table_name: 'credit_cards', record: r })),
      ...fixed.map((r) => ({ table_name: 'fixed_expenses', record: r })),
      ...funcionaria.map((r) => ({ table_name: 'funcionaria_payments', record: r })),
    ];

    if (month) {
      records = records.filter((r) => r.record.month === Number(month));
    }
    records.sort((a, b) => b.record.year - a.record.year || b.record.month - a.record.month);

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>';
      infoEl.textContent = '';
      return;
    }

    tbody.innerHTML = records.map(({ table_name, record }) => `
      <tr>
        <td>${TABLE_LABELS[table_name]}</td>
        <td class="text-nowrap">${monthName(record.month)}/${record.year}</td>
        <td class="small">${renderQueryRowDetails(table_name, record)}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-query-action="edit"
                  data-table-name="${table_name}" data-record-id="${record.id}" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-query-action="delete"
                  data-table-name="${table_name}" data-record-id="${record.id}" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
    infoEl.textContent = `${records.length} registro(s) exibido(s).`;
  } catch (err) {
    showToast(err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Erro ao carregar os lançamentos.</td></tr>';
  }
}

const QUERY_API = { credit_cards: creditCardsApi, fixed_expenses: fixedExpensesApi, funcionaria_payments: funcionariaPaymentsApi };

async function handleEditQueryRecord(tableName, recordId) {
  const api = QUERY_API[tableName];
  if (!api) return;

  let record;
  try {
    record = await api.getById(recordId);
  } catch (err) {
    showToast(err.message === 'Registro não encontrado.' ? 'Este lançamento não existe mais.' : err.message, 'error');
    refreshQueryResults();
    return;
  }

  const values = await editRecordModal(buildEditSpec(tableName, record));
  if (!values) return;

  try {
    await api.update(recordId, values);
    showToast('Lançamento atualizado com sucesso.', 'success');
    refreshQueryResults();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteQueryRecord(tableName, recordId) {
  if (!confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return;
  const api = QUERY_API[tableName];
  if (!api) return;

  try {
    await api.remove(recordId);
    showToast('Lançamento removido com sucesso.', 'success');
    refreshQueryResults();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
