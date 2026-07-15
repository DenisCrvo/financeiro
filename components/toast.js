// Toast de notificação (sucesso, erro, aviso) usando Bootstrap 5.

let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '1080';
    document.body.appendChild(container);
  }
  return container;
}

const ICONS = {
  success: 'bi-check-circle-fill text-success',
  error: 'bi-x-circle-fill text-danger',
  warning: 'bi-exclamation-triangle-fill text-warning',
  info: 'bi-info-circle-fill text-info',
};

export function showToast(message, type = 'success', { delay = 4000 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast align-items-center border-0';
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi ${ICONS[type] || ICONS.info} me-2"></i>${message}
      </div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
  `;
  getContainer().appendChild(el);
  const toast = new bootstrap.Toast(el, { delay });
  toast.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}
