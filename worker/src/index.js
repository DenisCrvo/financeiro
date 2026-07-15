// Worker principal: roteamento, autenticação por API Key e CORS.
// financeiro-api — Sistema de Previsão de Despesas Pessoais

import { errorResponse, corsHeaders, HttpError } from './utils.js';
import * as creditCards from './routes/creditCards.js';
import * as employee from './routes/employee.js';
import * as advances from './routes/advances.js';
import * as expenseTypes from './routes/expenseTypes.js';
import * as fixedExpenses from './routes/fixedExpenses.js';
import * as dashboard from './routes/dashboard.js';

// Rotas estáticas (sem :id) — avaliadas antes das rotas com parâmetro.
const STATIC_ROUTES = [
  { method: 'GET', path: '/api/credit-cards', handler: creditCards.listCreditCards },
  { method: 'GET', path: '/api/credit-cards/check', handler: creditCards.checkCreditCard },
  { method: 'POST', path: '/api/credit-cards', handler: creditCards.createCreditCard },

  { method: 'GET', path: '/api/employee', handler: employee.listEmployeeMonthly },
  { method: 'GET', path: '/api/employee/check', handler: employee.checkEmployeeMonthly },
  { method: 'POST', path: '/api/employee', handler: employee.createEmployeeMonthly },

  { method: 'GET', path: '/api/advances', handler: advances.listAdvances },
  { method: 'GET', path: '/api/advances/summary', handler: advances.advancesSummary },
  { method: 'POST', path: '/api/advances', handler: advances.createAdvance },

  { method: 'GET', path: '/api/expense-types', handler: expenseTypes.listExpenseTypes },
  { method: 'POST', path: '/api/expense-types', handler: expenseTypes.createExpenseType },

  { method: 'GET', path: '/api/fixed-expenses', handler: fixedExpenses.listFixedExpenses },
  { method: 'POST', path: '/api/fixed-expenses', handler: fixedExpenses.createFixedExpenses },

  { method: 'GET', path: '/api/dashboard', handler: dashboard.getDashboard },
  { method: 'GET', path: '/api/dashboard/last-update', handler: dashboard.getLastUpdate },
];

// Rotas com :id — prefixo + handlers por método.
const ID_ROUTES = [
  { prefix: '/api/credit-cards/', handlers: { PUT: creditCards.updateCreditCard, DELETE: creditCards.deleteCreditCard } },
  { prefix: '/api/employee/', handlers: { PUT: employee.updateEmployeeMonthly, DELETE: employee.deleteEmployeeMonthly } },
  { prefix: '/api/advances/', handlers: { PUT: advances.updateAdvance, DELETE: advances.deleteAdvance } },
  { prefix: '/api/expense-types/', handlers: { DELETE: expenseTypes.deleteExpenseType } },
  { prefix: '/api/fixed-expenses/', handlers: { PUT: fixedExpenses.updateFixedExpense, DELETE: fixedExpenses.deleteFixedExpense } },
];

function matchStaticRoute(method, pathname) {
  return STATIC_ROUTES.find((r) => r.method === method && r.path === pathname);
}

function matchIdRoute(method, pathname) {
  for (const route of ID_ROUTES) {
    if (pathname.startsWith(route.prefix)) {
      const rest = pathname.slice(route.prefix.length);
      if (/^\d+$/.test(rest) && route.handlers[method]) {
        return { handler: route.handlers[method], id: Number(rest) };
      }
    }
  }
  return null;
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = env.ALLOWED_ORIGIN || '*';
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // Autenticação por API Key (exceto preflight, já tratado acima).
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!env.API_KEY || token !== env.API_KEY) {
    return errorResponse('Não autorizado.', 401, cors);
  }

  const staticRoute = matchStaticRoute(request.method, url.pathname);
  if (staticRoute) {
    const response = await staticRoute.handler(request, env, url);
    return withCors(response, cors);
  }

  const idRoute = matchIdRoute(request.method, url.pathname);
  if (idRoute) {
    const response = await idRoute.handler(request, env, idRoute.id);
    return withCors(response, cors);
  }

  return errorResponse('Rota não encontrada.', 404, cors);
}

function withCors(response, cors) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      if (err instanceof HttpError) {
        return withCors(errorResponse(err.message, err.status), corsHeaders(env.ALLOWED_ORIGIN || '*'));
      }
      console.error(err);
      return withCors(
        errorResponse('Erro interno no servidor.', 500),
        corsHeaders(env.ALLOWED_ORIGIN || '*')
      );
    }
  },
};
