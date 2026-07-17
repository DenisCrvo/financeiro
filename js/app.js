// Orquestração da tela de Cadastro de Despesas (index.html).
// Liga os formulários da interface aos serviços de negócio e à API.

import {
  creditCardsApi, expenseTypesApi, fixedExpensesApi,
  funcionariosApi, parametrosLegaisApi, folhaApi,
} from './api.js';
import {
  formatCurrencyBRL, attachCurrencyMask, getCurrencyInputValue,
  populateYearSelect, populateMonthSelect, monthName, MONTH_NAMES_PT,
} from './utils.js';
import { showToast } from '../components/toast.js';
import {
  confirmModal, newExpenseTypeModal, manageExpenseTypesModal, editRecordModal, infoModal,
} from '../components/modal.js';
import { validateCreditCardForm, validateFixedExpenseForm } from '../services/financeiroService.js';

const CARD_LABELS = { bradesco: 'Bradesco', nubank: 'Nubank' };

document.addEventListener('DOMContentLoaded', () => {
  initCreditCardsSection();
  initFixedExpensesSection();
  initFolhaSection();
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
    refreshQueryResults();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Folha de Pagamento — Empregada Doméstica (eSocial Doméstico, LC 150/2015)
// ---------------------------------------------------------------------------

const SITUACAO_LABELS = { ativo: 'Ativo', afastado: 'Afastado', desligado: 'Desligado' };
const SITUACAO_BADGE = { ativo: 'text-bg-success', afastado: 'text-bg-warning', desligado: 'text-bg-secondary' };
const FOLHA_VERBA_FIELDS = [
  'horas_extras', 'adicional_noturno', 'insalubridade', 'periculosidade', 'comissoes', 'outras_verbas', 'descontos',
];

function initFolhaSection() {
  const form = document.querySelector('[data-form="folha"]');
  if (!form) return;

  populateYearSelect(form.querySelector('[data-field="year"]'));
  populateMonthSelect(form.querySelector('[data-field="month"]'));
  attachCurrencyMask(form.querySelector('[data-field="salario_base"]'));
  attachCurrencyMask(form.querySelector('[data-field="valor_passagem_dia"]'));
  FOLHA_VERBA_FIELDS.forEach((field) => attachCurrencyMask(form.querySelector(`[data-field="${field}"]`)));

  document.querySelector('[data-action="new-funcionaria"]').addEventListener('click', handleNewFuncionaria);

  form.addEventListener('submit', handleProcessarFolha);

  loadFuncionariasIntoSelect(form.querySelector('[data-field="funcionaria_id"]'));
  refreshFuncionariasList();
  refreshFolhasList();
}

async function loadFuncionariasIntoSelect(select) {
  try {
    const funcionarias = await funcionariosApi.list('ativo');
    const previousValue = select.value;
    select.innerHTML = '<option value="" disabled selected>Selecione...</option>' +
      funcionarias.map((f) => `<option value="${f.id}">${f.nome}</option>`).join('');
    if (previousValue && funcionarias.some((f) => String(f.id) === previousValue)) select.value = previousValue;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleNewFuncionaria() {
  const values = await editRecordModal({
    title: 'Nova Funcionária',
    fields: [
      { key: 'nome', label: 'Nome', type: 'text', value: '' },
    ],
  });
  if (!values) return;
  if (!values.nome?.trim()) {
    showToast('Informe o nome.', 'warning');
    return;
  }

  try {
    await funcionariosApi.create({ nome: values.nome.trim() });
    showToast('Funcionária cadastrada com sucesso.', 'success');
    await refreshFuncionariasList();
    await loadFuncionariasIntoSelect(document.querySelector('[data-form="folha"] [data-field="funcionaria_id"]'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleEditFuncionaria(id) {
  let funcionaria;
  try {
    funcionaria = await funcionariosApi.getById(id);
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  const values = await editRecordModal({
    title: 'Editar Funcionária',
    fields: [
      { key: 'nome', label: 'Nome', type: 'text', value: funcionaria.nome },
      { key: 'cpf', label: 'CPF (opcional, somente números)', type: 'text', value: funcionaria.cpf ?? '' },
      { key: 'nis', label: 'NIS/PIS (opcional)', type: 'text', value: funcionaria.nis ?? '' },
      { key: 'data_admissao', label: 'Data de admissão (opcional)', type: 'date', value: funcionaria.data_admissao ?? '' },
      { key: 'cargo', label: 'Cargo', type: 'text', value: funcionaria.cargo },
      { key: 'dependentes_irrf', label: 'Dependentes para dedução do IRRF', type: 'number', value: funcionaria.dependentes_irrf },
    ],
  });
  if (!values) return;

  try {
    await funcionariosApi.update(id, values);
    showToast('Funcionária atualizada com sucesso.', 'success');
    await refreshFuncionariasList();
    await loadFuncionariasIntoSelect(document.querySelector('[data-form="folha"] [data-field="funcionaria_id"]'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function refreshFuncionariasList() {
  const tbody = document.querySelector('[data-table="funcionarias-list"]');
  if (!tbody) return;
  try {
    const funcionarias = await funcionariosApi.list();
    if (funcionarias.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-3">Nenhuma funcionária cadastrada.</td></tr>';
      return;
    }
    tbody.innerHTML = funcionarias.map((f) => `
      <tr>
        <td>${f.nome}</td>
        <td>${f.cpf ?? '—'}</td>
        <td>${f.data_admissao ? new Date(f.data_admissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
        <td><span class="badge ${SITUACAO_BADGE[f.situacao]}">${SITUACAO_LABELS[f.situacao]}</span></td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-funcionaria-action="editar" data-id="${f.id}" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          ${f.situacao !== 'desligado' ? `
          <button type="button" class="btn btn-sm btn-outline-warning me-1" data-funcionaria-action="desligar" data-id="${f.id}" title="Desligar">
            <i class="bi bi-person-dash"></i>
          </button>` : ''}
          <button type="button" class="btn btn-sm btn-outline-danger" data-funcionaria-action="excluir" data-id="${f.id}" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-funcionaria-action="editar"]').forEach((btn) => {
      btn.addEventListener('click', () => handleEditFuncionaria(btn.dataset.id));
    });
    tbody.querySelectorAll('[data-funcionaria-action="desligar"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const dataDesligamento = prompt('Data de desligamento (AAAA-MM-DD):', new Date().toISOString().slice(0, 10));
        if (!dataDesligamento) return;
        try {
          await funcionariosApi.update(btn.dataset.id, { situacao: 'desligado', data_desligamento: dataDesligamento });
          showToast('Funcionária desligada.', 'success');
          await refreshFuncionariasList();
          await loadFuncionariasIntoSelect(document.querySelector('[data-form="folha"] [data-field="funcionaria_id"]'));
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
    tbody.querySelectorAll('[data-funcionaria-action="excluir"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir esta funcionária?')) return;
        try {
          await funcionariosApi.remove(btn.dataset.id);
          showToast('Funcionária removida.', 'success');
          await refreshFuncionariasList();
          await loadFuncionariasIntoSelect(document.querySelector('[data-form="folha"] [data-field="funcionaria_id"]'));
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleProcessarFolha(e) {
  e.preventDefault();
  const form = e.target;
  const funcionariaId = form.querySelector('[data-field="funcionaria_id"]').value;
  const year = form.querySelector('[data-field="year"]').value;
  const month = form.querySelector('[data-field="month"]').value;
  const salarioBase = getCurrencyInputValue(form.querySelector('[data-field="salario_base"]'));
  const diasUteis = Number(form.querySelector('[data-field="dias_uteis"]').value) || 0;
  const valorPassagemDia = getCurrencyInputValue(form.querySelector('[data-field="valor_passagem_dia"]'));
  const percentualInput = form.querySelector('[data-field="percentual_desconto_vt"]').value;

  if (!funcionariaId) { showToast('Selecione a funcionária.', 'warning'); return; }
  if (salarioBase <= 0) { showToast('Informe o salário base.', 'warning'); return; }

  const payload = {
    funcionaria_id: Number(funcionariaId),
    competencia: `${year}-${String(month).padStart(2, '0')}`,
    salario_base: salarioBase,
    dias_uteis: diasUteis,
    valor_passagem_dia: valorPassagemDia,
  };
  FOLHA_VERBA_FIELDS.forEach((field) => {
    payload[field] = getCurrencyInputValue(form.querySelector(`[data-field="${field}"]`));
  });
  if (percentualInput) payload.percentual_desconto_vt = Number(percentualInput) / 100;

  try {
    const folha = await folhaApi.processar(payload);
    showToast(`Folha processada — salário líquido: ${formatCurrencyBRL(folha.salario_liquido)}`, 'success');
    form.reset();
    populateYearSelect(form.querySelector('[data-field="year"]'));
    populateMonthSelect(form.querySelector('[data-field="month"]'));
    await refreshFolhasList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function refreshFolhasList() {
  const tbody = document.querySelector('[data-table="folhas-list"]');
  if (!tbody) return;
  try {
    const folhas = await folhaApi.list();
    if (folhas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-3">Nenhuma folha processada.</td></tr>';
      return;
    }
    tbody.innerHTML = folhas.map((f) => `
      <tr>
        <td>${monthName(Number(f.competencia.slice(5, 7)))}/${f.competencia.slice(0, 4)}</td>
        <td>${f.funcionaria_nome}</td>
        <td class="text-end">${formatCurrencyBRL(f.salario_liquido)}</td>
        <td><span class="badge ${f.status === 'fechada' ? 'text-bg-secondary' : 'text-bg-warning'}">${f.status === 'fechada' ? 'Fechada' : 'Aberta'}</span></td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-folha-action="ver" data-id="${f.id}" title="Ver detalhamento">
            <i class="bi bi-eye"></i>
          </button>
          ${f.status === 'aberta' ? `
          <button type="button" class="btn btn-sm btn-outline-success me-1" data-folha-action="fechar" data-id="${f.id}" title="Fechar folha">
            <i class="bi bi-lock"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-folha-action="excluir" data-id="${f.id}" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>` : ''}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-folha-action="ver"]').forEach((btn) => {
      btn.addEventListener('click', () => handleVerFolha(btn.dataset.id));
    });
    tbody.querySelectorAll('[data-folha-action="fechar"]').forEach((btn) => {
      btn.addEventListener('click', () => handleFecharFolha(btn.dataset.id));
    });
    tbody.querySelectorAll('[data-folha-action="excluir"]').forEach((btn) => {
      btn.addEventListener('click', () => handleExcluirFolha(btn.dataset.id));
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleVerFolha(id) {
  try {
    const f = await folhaApi.getById(id);
    await infoModal({
      title: `Folha — ${monthName(Number(f.competencia.slice(5, 7)))}/${f.competencia.slice(0, 4)} (${f.funcionaria_nome})`,
      rows: [
        ['Salário Base', formatCurrencyBRL(f.salario_base)],
        ['Salário Bruto', formatCurrencyBRL(f.salario_bruto)],
        ['Base INSS', formatCurrencyBRL(f.base_inss)],
        ['INSS (empregado)', formatCurrencyBRL(f.valor_inss)],
        ['Base IRRF', formatCurrencyBRL(f.base_irrf)],
        ['IRRF', formatCurrencyBRL(f.valor_irrf)],
        ['Base FGTS', formatCurrencyBRL(f.base_fgts)],
        ['FGTS (8%)', formatCurrencyBRL(f.valor_fgts)],
        ['FGTS Indenizatório (3,2%)', formatCurrencyBRL(f.valor_fgts_indenizatorio)],
        ['Encargos Empregador (INSS patronal + RAT)', formatCurrencyBRL(f.encargos_empregador)],
        ['VT Depositado', formatCurrencyBRL(f.valor_vt_depositado)],
        ['Desconto VT', formatCurrencyBRL(f.desconto_vt)],
        ['Descontos Diversos', formatCurrencyBRL(f.descontos)],
        ['Salário Líquido', formatCurrencyBRL(f.salario_liquido)],
        ['Status', f.status === 'fechada' ? 'Fechada' : 'Aberta'],
      ],
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleFecharFolha(id) {
  if (!confirm('Fechar esta folha? Depois de fechada ela não poderá mais ser alterada ou excluída, e os lançamentos financeiros (salário, VT e encargos) serão registrados automaticamente.')) return;
  try {
    await folhaApi.fechar(id);
    showToast('Folha fechada e lançamentos financeiros registrados.', 'success');
    await refreshFolhasList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleExcluirFolha(id) {
  if (!confirm('Excluir esta folha (ainda aberta)?')) return;
  try {
    await folhaApi.remove(id);
    showToast('Folha removida.', 'success');
    await refreshFolhasList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Consultar e Editar Lançamentos
// ---------------------------------------------------------------------------

const TABLE_LABELS = { credit_cards: 'Cartão de Crédito', fixed_expenses: 'Despesa Fixa' };

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
    const [cards, fixed] = await Promise.all([
      tableFilter && tableFilter !== 'credit_cards' ? [] : creditCardsApi.list(year),
      tableFilter && tableFilter !== 'fixed_expenses' ? [] : fixedExpensesApi.list(year),
    ]);

    let records = [
      ...cards.map((r) => ({ table_name: 'credit_cards', record: r })),
      ...fixed.map((r) => ({ table_name: 'fixed_expenses', record: r })),
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

const QUERY_API = { credit_cards: creditCardsApi, fixed_expenses: fixedExpensesApi };

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
