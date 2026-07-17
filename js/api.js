// Camada de comunicação com a API (Cloudflare Workers).
// IMPORTANTE: edite API_BASE_URL e API_KEY antes de publicar (ver README,
// seção "Como alterar URL da API").

export const API_BASE_URL = 'https://cloudfinanceiro.deniscrvo.workers.dev';
const API_KEY = 'rFi--xQNRgPFgCA1E4sMsaxe4f-Iuu_AgS4MlP1wKSQ';

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError('Não foi possível conectar à API. Verifique sua conexão.', 0, null);
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = null; }
  }

  if (!response.ok) {
    const message = payload?.error || `Erro na requisição (${response.status}).`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + new URLSearchParams(entries).toString();
}

export { ApiError };

export const creditCardsApi = {
  list: (year) => request(`/api/credit-cards${qs({ year })}`),
  check: (cardName, year, month) => request(`/api/credit-cards/check${qs({ card_name: cardName, year, month })}`),
  getById: (id) => request(`/api/credit-cards/${id}`),
  create: (data) => request('/api/credit-cards', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/credit-cards/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/credit-cards/${id}`, { method: 'DELETE' }),
};

export const expenseTypesApi = {
  list: () => request('/api/expense-types'),
  create: (data) => request('/api/expense-types', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/expense-types/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/expense-types/${id}`, { method: 'DELETE' }),
};

export const fixedExpensesApi = {
  list: (year) => request(`/api/fixed-expenses${qs({ year })}`),
  getById: (id) => request(`/api/fixed-expenses/${id}`),
  create: (data) => request('/api/fixed-expenses', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/fixed-expenses/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/fixed-expenses/${id}`, { method: 'DELETE' }),
};

export const dashboardApi = {
  get: (year) => request(`/api/dashboard${qs({ year })}`),
  lastUpdate: () => request('/api/dashboard/last-update'),
};

// Módulo de Folha de Pagamento — Empregada Doméstica (eSocial Doméstico,
// LC 150/2015). Ver worker/PAYROLL.md para a documentação completa.
export const funcionariosApi = {
  list: (situacao) => request(`/api/funcionarios${qs({ situacao })}`),
  getById: (id) => request(`/api/funcionarios/${id}`),
  create: (data) => request('/api/funcionarios', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/funcionarios/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/funcionarios/${id}`, { method: 'DELETE' }),
};

export const parametrosLegaisApi = {
  list: () => request('/api/parametros-legais'),
  vigentes: (competencia) => request(`/api/parametros-legais/vigentes${qs({ competencia })}`),
};

export const folhaApi = {
  list: ({ funcionaria_id, year } = {}) => request(`/api/folha${qs({ funcionaria_id, year })}`),
  getById: (id) => request(`/api/folha/${id}`),
  processar: (data) => request('/api/folha', { method: 'POST', body: data }),
  fechar: (id) => request(`/api/folha/${id}/fechar`, { method: 'POST' }),
  remove: (id) => request(`/api/folha/${id}`, { method: 'DELETE' }),
};
