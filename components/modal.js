// Modais reutilizáveis: confirmação de lançamento e cadastro de nova despesa.

import { formatCurrencyBRL, parseCurrencyInput } from '../js/utils.js';

function createModalElement(innerHtml, extraClass = '') {
  const wrapper = document.createElement('div');
  wrapper.className = `modal fade ${extraClass}`;
  wrapper.tabIndex = -1;
  wrapper.innerHTML = innerHtml;
  document.body.appendChild(wrapper);
  return wrapper;
}

/**
 * Exibe um modal de confirmação com um resumo do lançamento.
 * @param {{title: string, rows: Array<[string,string]>}} options
 * @returns {Promise<boolean>} true se confirmado, false se cancelado
 */
export function confirmModal({ title = 'Confirmar lançamento?', rows = [] }) {
  return new Promise((resolve) => {
    const rowsHtml = rows.map(
      ([label, value]) => `
        <div class="d-flex justify-content-between border-bottom py-2">
          <span class="text-secondary">${label}</span>
          <span class="fw-semibold">${value}</span>
        </div>`
    ).join('');

    const el = createModalElement(`
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-clipboard-check me-2"></i>${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">${rowsHtml}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-action="cancel">Cancelar</button>
            <button type="button" class="btn btn-primary" data-action="confirm">Confirmar</button>
          </div>
        </div>
      </div>
    `);

    const bsModal = new bootstrap.Modal(el);
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
      hideModal(bsModal, el);
    };

    el.querySelector('[data-action="confirm"]').addEventListener('click', () => finish(true));
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => finish(false));
    el.addEventListener('hidden.bs.modal', () => { finish(false); el.remove(); });
    markModalAsShown(el);

    bsModal.show();
  });
}

/**
 * bootstrap.Modal.hide() é um no-op se chamado enquanto a transição de
 * abertura ainda está em andamento (_isTransitioning interno do Bootstrap).
 * Um clique muito rápido logo após o modal abrir cairia nessa janela e
 * deixaria o modal (e o backdrop) travados na tela, bloqueando a página.
 * markModalAsShown() marca quando a transição termina; hideModal() adia
 * o hide() para depois desse ponto quando necessário.
 */
function markModalAsShown(el) {
  el.addEventListener('shown.bs.modal', () => { el.dataset.shown = 'true'; });
}

function hideModal(bsModal, el) {
  if (el.dataset.shown === 'true') {
    bsModal.hide();
  } else {
    el.addEventListener('shown.bs.modal', () => bsModal.hide(), { once: true });
  }
}

/**
 * Modal para cadastro de um novo tipo de despesa.
 * @returns {Promise<string|null>} nome da despesa, ou null se cancelado
 */
export function newExpenseTypeModal() {
  return new Promise((resolve) => {
    const el = createModalElement(`
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Nova despesa fixa</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <label class="form-label" for="new-expense-type-name">Nome da despesa</label>
            <input type="text" id="new-expense-type-name" class="form-control" placeholder="Ex.: Streaming, Academia..." maxlength="60" required>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-action="cancel">Cancelar</button>
            <button type="button" class="btn btn-primary" data-action="save">Salvar</button>
          </div>
        </div>
      </div>
    `);

    const bsModal = new bootstrap.Modal(el);
    const input = el.querySelector('#new-expense-type-name');
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
      hideModal(bsModal, el);
    };

    el.querySelector('[data-action="save"]').addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) { input.classList.add('is-invalid'); return; }
      finish(name);
    });
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => finish(null));
    el.addEventListener('hidden.bs.modal', () => { finish(null); el.remove(); });
    el.addEventListener('shown.bs.modal', () => input.focus());
    markModalAsShown(el);

    bsModal.show();
  });
}

/**
 * Modal de gerenciamento dos tipos de despesa fixa: renomear ou excluir.
 * A lógica de API fica a cargo do chamador via callbacks, mantendo este
 * componente livre de dependências de serviço.
 * @param {Array<{id:number,name:string}>} types
 * @param {{onRename: (id:number, name:string) => Promise<any>, onDelete: (id:number) => Promise<any>}} handlers
 * @returns {Promise<void>} resolve quando o modal é fechado
 */
export function manageExpenseTypesModal(types, { onRename, onDelete }) {
  return new Promise((resolve) => {
    let currentTypes = [...types];

    const el = createModalElement(`
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-sliders me-2"></i>Gerenciar tipos de despesa</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <ul class="list-group" data-types-list></ul>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-action="close">Fechar</button>
          </div>
        </div>
      </div>
    `);

    const listEl = el.querySelector('[data-types-list]');

    function renderRow(type) {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.dataset.id = String(type.id);
      li.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <input type="text" class="form-control form-control-sm" value="${type.name.replace(/"/g, '&quot;')}" maxlength="60">
          <button type="button" class="btn btn-sm btn-outline-primary" data-row-action="save" title="Salvar">
            <i class="bi bi-check-lg"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-row-action="delete" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <div class="invalid-feedback d-block small mt-1" data-row-error style="display:none !important;"></div>
      `;

      const input = li.querySelector('input');
      const errorEl = li.querySelector('[data-row-error]');

      function showError(message) {
        errorEl.textContent = message;
        errorEl.style.setProperty('display', 'block', 'important');
      }
      function clearError() {
        errorEl.style.setProperty('display', 'none', 'important');
      }

      li.querySelector('[data-row-action="save"]').addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) { showError('O nome não pode ser vazio.'); return; }
        if (name === type.name) { clearError(); return; }
        try {
          await onRename(type.id, name);
          type.name = name;
          clearError();
        } catch (err) {
          showError(err.message);
        }
      });

      li.querySelector('[data-row-action="delete"]').addEventListener('click', async () => {
        if (!confirm(`Excluir o tipo de despesa "${type.name}"?`)) return;
        try {
          await onDelete(type.id);
          currentTypes = currentTypes.filter((t) => t.id !== type.id);
          li.remove();
        } catch (err) {
          showError(err.message);
        }
      });

      return li;
    }

    function renderList() {
      listEl.innerHTML = '';
      if (currentTypes.length === 0) {
        listEl.innerHTML = '<li class="list-group-item text-secondary text-center">Nenhum tipo cadastrado.</li>';
        return;
      }
      currentTypes.forEach((type) => listEl.appendChild(renderRow(type)));
    }

    renderList();

    const bsModal = new bootstrap.Modal(el);
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
      hideModal(bsModal, el);
    };

    el.querySelector('[data-action="close"]').addEventListener('click', () => finish());
    el.addEventListener('hidden.bs.modal', () => { finish(); el.remove(); });
    markModalAsShown(el);

    bsModal.show();
  });
}

/**
 * Modal genérico para editar um lançamento existente (usado no histórico do
 * Dashboard). Os campos exibidos variam por tipo de tabela — quem decide isso
 * é o chamador, este componente só sabe renderizar `fields` e devolver os
 * valores preenchidos.
 * @param {{
 *   title: string,
 *   readOnlyRows?: Array<[string,string]>,
 *   fields: Array<{key:string, label:string, type:'currency'|'number'|'text', value:any}>,
 * }} options
 * @returns {Promise<Object|null>} valores por `key` (currency/number já convertidos), ou null se cancelado
 */
export function editRecordModal({ title, readOnlyRows = [], fields }) {
  return new Promise((resolve) => {
    const readOnlyHtml = readOnlyRows.map(
      ([label, value]) => `
        <div class="d-flex justify-content-between border-bottom py-1 small">
          <span class="text-secondary">${label}</span>
          <span>${value}</span>
        </div>`
    ).join('');

    const fieldsHtml = fields.map((field) => {
      if (field.type === 'currency') {
        return `
          <div class="mb-2">
            <label class="form-label small">${field.label}</label>
            <div class="input-group">
              <span class="input-group-text">R$</span>
              <input type="text" class="form-control" data-field-key="${field.key}" data-field-type="currency"
                     value="${formatCurrencyBRL(field.value).replace('R$', '').trim()}" inputmode="decimal">
            </div>
          </div>`;
      }
      if (field.type === 'number') {
        return `
          <div class="mb-2">
            <label class="form-label small">${field.label}</label>
            <input type="number" min="0" class="form-control" data-field-key="${field.key}" data-field-type="number"
                   value="${field.value ?? 0}">
          </div>`;
      }
      if (field.type === 'date') {
        return `
          <div class="mb-2">
            <label class="form-label small">${field.label}</label>
            <input type="date" class="form-control" data-field-key="${field.key}" data-field-type="text"
                   value="${field.value ?? ''}">
          </div>`;
      }
      return `
        <div class="mb-2">
          <label class="form-label small">${field.label}</label>
          <input type="text" class="form-control" data-field-key="${field.key}" data-field-type="text"
                 value="${(field.value ?? '').toString().replace(/"/g, '&quot;')}" maxlength="120">
        </div>`;
    }).join('');

    const el = createModalElement(`
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-pencil-square me-2"></i>${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${readOnlyHtml ? `<div class="mb-3">${readOnlyHtml}</div>` : ''}
            ${fieldsHtml}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-action="cancel">Cancelar</button>
            <button type="button" class="btn btn-primary" data-action="save">Salvar</button>
          </div>
        </div>
      </div>
    `);

    el.querySelectorAll('input[data-field-type="currency"]').forEach((input) => {
      input.addEventListener('input', () => {
        input.value = formatCurrencyBRL(parseCurrencyInput(input.value)).replace('R$', '').trim();
      });
    });

    const bsModal = new bootstrap.Modal(el);
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
      hideModal(bsModal, el);
    };

    // Bootstrap move o foco para o próprio <div class="modal"> assim que a
    // transição de abertura termina ('shown.bs.modal'), mesmo que o usuário
    // já tenha clicado e começado a digitar no campo antes disso — o efeito
    // é perder os caracteres digitados nesse meio-tempo. Focar o primeiro
    // campo aqui garante que o foco volte para ele (não para o modal),
    // sem cortar a digitação em andamento.
    const firstField = el.querySelector('[data-field-key]');
    if (firstField) {
      el.addEventListener('shown.bs.modal', () => firstField.focus());
    }

    el.querySelector('[data-action="save"]').addEventListener('click', () => {
      const values = {};
      el.querySelectorAll('[data-field-key]').forEach((input) => {
        const key = input.dataset.fieldKey;
        const type = input.dataset.fieldType;
        if (type === 'currency') values[key] = parseCurrencyInput(input.value);
        else if (type === 'number') values[key] = Number(input.value) || 0;
        else values[key] = input.value.trim();
      });
      finish(values);
    });
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => finish(null));
    el.addEventListener('hidden.bs.modal', () => { finish(null); el.remove(); });
    markModalAsShown(el);

    bsModal.show();
  });
}

/**
 * Modal somente leitura, para exibir um detalhamento (ex.: composição de uma
 * folha de pagamento). Um único botão "Fechar".
 * @param {{title: string, rows: Array<[string,string]>}} options
 * @returns {Promise<void>}
 */
export function infoModal({ title, rows = [] }) {
  return new Promise((resolve) => {
    const rowsHtml = rows.map(
      ([label, value]) => `
        <div class="d-flex justify-content-between border-bottom py-2">
          <span class="text-secondary">${label}</span>
          <span class="fw-semibold">${value}</span>
        </div>`
    ).join('');

    const el = createModalElement(`
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-info-circle me-2"></i>${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">${rowsHtml}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-action="close">Fechar</button>
          </div>
        </div>
      </div>
    `);

    const bsModal = new bootstrap.Modal(el);
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
      hideModal(bsModal, el);
    };

    el.querySelector('[data-action="close"]').addEventListener('click', () => finish());
    el.addEventListener('hidden.bs.modal', () => { finish(); el.remove(); });
    markModalAsShown(el);

    bsModal.show();
  });
}
