// Rotas: /api/avista-payments
// Pagamentos à Vista / PIX — mesmo conceito de fixed_expenses (lançamento
// em lote por vários meses via "months": [1,2,3], mesmo batch_id), porém
// categorizado por um tipo de despesa próprio (`avista_expense_types`),
// independente de `expense_types` (Despesas Fixas).

import {
  jsonResponse, errorResponse, parseJsonBody, requireFields,
  assertNonNegativeNumber, assertMonth, assertYear, HttpError,
} from '../utils.js';

export async function listAvistaPayments(request, env, url) {
  const year = url.searchParams.get('year');
  let query = `
    SELECT ap.*, et.name AS expense_type_name, et.icon AS expense_type_icon
    FROM avista_payments ap
    JOIN avista_expense_types et ON et.id = ap.expense_type_id
  `;
  const params = [];
  if (year) {
    query += ' WHERE ap.year = ?';
    params.push(assertYear(year));
  }
  query += ' ORDER BY ap.year DESC, ap.month DESC, et.name ASC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse(results);
}

export async function createAvistaPayments(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['expense_type_id', 'year', 'months', 'value']);

  const expenseTypeId = Number(body.expense_type_id);
  const year = assertYear(body.year);
  const value = assertNonNegativeNumber(body.value, 'value');
  const description = body.description ? String(body.description).trim() : null;

  if (!Array.isArray(body.months) || body.months.length === 0) {
    throw new HttpError('O campo "months" deve ser uma lista com ao menos um mês.', 422);
  }
  const months = [...new Set(body.months.map((m) => assertMonth(m)))];

  const typeExists = await env.DB.prepare('SELECT id FROM avista_expense_types WHERE id = ?')
    .bind(expenseTypeId).first();
  if (!typeExists) throw new HttpError('Tipo de despesa não encontrado.', 422);

  const conflicts = [];
  for (const month of months) {
    const existing = await env.DB.prepare(
      'SELECT id FROM avista_payments WHERE expense_type_id = ? AND year = ? AND month = ?'
    ).bind(expenseTypeId, year, month).first();
    if (existing) conflicts.push(month);
  }
  if (conflicts.length > 0) {
    return jsonResponse({
      error: `Já existe lançamento desta despesa nos meses: ${conflicts.join(', ')}.`,
      conflicts,
    }, 409);
  }

  const batchId = crypto.randomUUID();
  const created = [];
  for (const month of months) {
    const result = await env.DB.prepare(
      `INSERT INTO avista_payments (expense_type_id, year, month, value, description, batch_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(expenseTypeId, year, month, value, description, batchId).run();
    created.push(result.meta.last_row_id);
  }

  const placeholders = created.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT ap.*, et.name AS expense_type_name, et.icon AS expense_type_icon
     FROM avista_payments ap JOIN avista_expense_types et ON et.id = ap.expense_type_id
     WHERE ap.id IN (${placeholders})`
  ).bind(...created).all();

  return jsonResponse(results, 201);
}

export async function getAvistaPayment(request, env, id) {
  const record = await env.DB.prepare(
    `SELECT ap.*, et.name AS expense_type_name, et.icon AS expense_type_icon
     FROM avista_payments ap JOIN avista_expense_types et ON et.id = ap.expense_type_id
     WHERE ap.id = ?`
  ).bind(id).first();
  if (!record) return errorResponse('Registro não encontrado.', 404);
  return jsonResponse(record);
}

export async function updateAvistaPayment(request, env, id) {
  const body = await parseJsonBody(request);
  requireFields(body, ['value']);
  const value = assertNonNegativeNumber(body.value, 'value');
  const description = body.description !== undefined ? String(body.description).trim() || null : undefined;

  const existing = await env.DB.prepare('SELECT * FROM avista_payments WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  await env.DB.prepare(
    `UPDATE avista_payments SET value = ?, description = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).bind(value, description !== undefined ? description : existing.description, id).run();

  const updated = await env.DB.prepare(
    `SELECT ap.*, et.name AS expense_type_name, et.icon AS expense_type_icon
     FROM avista_payments ap JOIN avista_expense_types et ON et.id = ap.expense_type_id
     WHERE ap.id = ?`
  ).bind(id).first();
  return jsonResponse(updated);
}

export async function deleteAvistaPayment(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM avista_payments WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);
  await env.DB.prepare('DELETE FROM avista_payments WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}
