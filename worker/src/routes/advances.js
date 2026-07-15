// Rotas: /api/advances
// Cronograma de descontos de adiantamento (empréstimo) à funcionária, no
// mesmo formato de lançamento em lote usado em fixed-expenses (ano + meses).
// Uso exclusivo para controle de desconto em folha/e-social: estes valores
// NUNCA entram nos totais do Dashboard (ver routes/dashboard.js).

import {
  jsonResponse, errorResponse, parseJsonBody, requireFields,
  assertNonNegativeNumber, assertMonth, assertYear, HttpError,
} from '../utils.js';

function currentYearMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export async function listAdvances(request, env, url) {
  const year = url.searchParams.get('year');
  let query = 'SELECT * FROM employee_advances';
  const params = [];
  if (year) {
    query += ' WHERE year = ?';
    params.push(assertYear(year));
  }
  query += ' ORDER BY year DESC, month DESC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse(results);
}

export async function advancesSummary(request, env, url) {
  const year = url.searchParams.get('year');
  let query = 'SELECT year, month, discount_value FROM employee_advances';
  const params = [];
  if (year) {
    query += ' WHERE year = ?';
    params.push(assertYear(year));
  }
  const { results } = await env.DB.prepare(query).bind(...params).all();

  const { year: curYear, month: curMonth } = currentYearMonth();
  const isPastOrCurrent = (y, m) => y < curYear || (y === curYear && m <= curMonth);

  const totalBorrowed = results.reduce((sum, r) => sum + r.discount_value, 0);
  const totalDiscounted = results
    .filter((r) => isPastOrCurrent(r.year, r.month))
    .reduce((sum, r) => sum + r.discount_value, 0);
  const totalRemaining = totalBorrowed - totalDiscounted;

  return jsonResponse({
    year: year ?? null,
    total_borrowed: totalBorrowed,
    total_discounted: totalDiscounted,
    total_remaining: totalRemaining,
  });
}

export async function createAdvance(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['value', 'year', 'months']);
  const value = assertNonNegativeNumber(body.value, 'value');
  const year = assertYear(body.year);

  if (!Array.isArray(body.months) || body.months.length === 0) {
    throw new HttpError('O campo "months" deve ser uma lista com ao menos um mês.', 422);
  }
  const months = [...new Set(body.months.map((m) => assertMonth(m)))];

  const batchId = crypto.randomUUID();
  const created = [];
  for (const month of months) {
    const result = await env.DB.prepare(
      `INSERT INTO employee_advances (batch_id, year, month, discount_value)
       VALUES (?, ?, ?, ?)`
    ).bind(batchId, year, month, value).run();
    created.push(result.meta.last_row_id);
  }

  const placeholders = created.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT * FROM employee_advances WHERE id IN (${placeholders})`
  ).bind(...created).all();

  return jsonResponse(results, 201);
}

export async function updateAdvance(request, env, id) {
  const body = await parseJsonBody(request);
  requireFields(body, ['discount_value']);
  const discountValue = assertNonNegativeNumber(body.discount_value, 'discount_value');

  const existing = await env.DB.prepare('SELECT * FROM employee_advances WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  await env.DB.prepare(
    `UPDATE employee_advances SET discount_value = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).bind(discountValue, id).run();

  const updated = await env.DB.prepare('SELECT * FROM employee_advances WHERE id = ?').bind(id).first();
  return jsonResponse(updated);
}

export async function deleteAdvance(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM employee_advances WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);
  await env.DB.prepare('DELETE FROM employee_advances WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}
