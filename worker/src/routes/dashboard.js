// Rotas: /api/dashboard
// Agrega dados de todas as tabelas para alimentar os cards e o gráfico do
// Dashboard Financeiro.

import { jsonResponse, assertYear, monthName } from '../utils.js';

function nextMonthRef() {
  const now = new Date();
  let month = now.getUTCMonth() + 2; // getUTCMonth() é 0-indexado; +1 mês seguinte, +1 para 1-indexar
  let year = now.getUTCFullYear();
  if (month > 12) {
    month -= 12;
    year += 1;
  }
  return { year, month };
}

async function sumCards(env, year, month) {
  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(value), 0) AS total FROM credit_cards WHERE year = ? AND month = ?'
  ).bind(year, month).first();
  return row.total;
}

async function sumOtherExpenses(env, year, month) {
  const [fixedRow, funcionariaRow, avistaRow] = await Promise.all([
    env.DB.prepare(
      'SELECT COALESCE(SUM(value), 0) AS total FROM fixed_expenses WHERE year = ? AND month = ?'
    ).bind(year, month).first(),
    env.DB.prepare(
      'SELECT COALESCE(SUM(valor_pagar), 0) AS total FROM funcionaria_pagamentos WHERE year = ? AND month = ?'
    ).bind(year, month).first(),
    env.DB.prepare(
      'SELECT COALESCE(SUM(value), 0) AS total FROM avista_payments WHERE year = ? AND month = ?'
    ).bind(year, month).first(),
  ]);

  return fixedRow.total + funcionariaRow.total + avistaRow.total;
}

export async function getDashboard(request, env, url) {
  const year = assertYear(url.searchParams.get('year') ?? new Date().getUTCFullYear());
  const { year: nextYear, month: nextMonth } = nextMonthRef();

  const [nextMonthCardsTotal, otherExpensesTotal] = await Promise.all([
    sumCards(env, nextYear, nextMonth),
    sumOtherExpenses(env, nextYear, nextMonth),
  ]);

  const monthlyTotals = [];
  for (let month = 1; month <= 12; month++) {
    const [cards, others] = await Promise.all([
      sumCards(env, year, month),
      sumOtherExpenses(env, year, month),
    ]);
    monthlyTotals.push({ month, month_name: monthName(month), total: cards + others, cards_total: cards });
  }

  return jsonResponse({
    year,
    next_month: { year: nextYear, month: nextMonth, month_name: monthName(nextMonth) },
    cards_total_next_month: nextMonthCardsTotal,
    other_expenses_total_next_month: otherExpensesTotal,
    monthly_totals: monthlyTotals,
  });
}

export async function getLastUpdate(request, env) {
  const tables = ['credit_cards', 'fixed_expenses', 'funcionaria_pagamentos', 'avista_payments'];
  const timestamps = [];
  for (const table of tables) {
    const row = await env.DB.prepare(`SELECT MAX(updated_at) AS last FROM ${table}`).first();
    if (row.last) timestamps.push(row.last);
  }
  const lastUpdate = timestamps.sort().at(-1) ?? null;
  return jsonResponse({ last_update: lastUpdate });
}
