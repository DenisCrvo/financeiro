// Modais reutilizáveis: confirmação de lançamento e cadastro de nova despesa.

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
