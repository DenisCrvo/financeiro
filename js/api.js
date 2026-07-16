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
  create: (data) => request('/api/credit-cards', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/credit-cards/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/credit-cards/${id}`, { method: 'DELETE' }),
};

export const employeeApi = {
  list: (year) => request(`/api/employee${qs({ year })}`),
  check: (year, month) => request(`/api/employee/check${qs({ year, month })}`),
  create: (data) => request('/api/employee', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/employee/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/employee/${id}`, { method: 'DELETE' }),
};

// Cronograma de desconto de adiantamento — controle de folha/e-social,
// nunca contabilizado nos totais do Dashboard.
export const advancesApi = {
  list: (year) => request(`/api/advances${qs({ year })}`),
  summary: (year) => request(`/api/advances/summary${qs({ year })}`),
  create: (data) => request('/api/advances', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/advances/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/advances/${id}`, { method: 'DELETE' }),
};

export const expenseTypesApi = {
  list: () => request('/api/expense-types'),
  create: (data) => request('/api/expense-types', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/expense-types/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/expense-types/${id}`, { method: 'DELETE' }),
};

export const fixedExpensesApi = {
  list: (year) => request(`/api/fixed-expenses${qs({ year })}`),
  create: (data) => request('/api/fixed-expenses', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/fixed-expenses/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/fixed-expenses/${id}`, { method: 'DELETE' }),
};

export const dashboardApi = {
  get: (year) => request(`/api/dashboard${qs({ year })}`),
  lastUpdate: () => request('/api/dashboard/last-update'),
};
