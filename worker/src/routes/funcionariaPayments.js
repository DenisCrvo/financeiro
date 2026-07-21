// Rotas: /api/funcionaria-payments
// Pagamento mensal associado a um tipo de despesa próprio
// (`funcionaria_expense_types` — independente do `expense_types` usado por
// Despesas Fixas), no mesmo formato de lançamento em lote ("months":
// [1,2,3] → uma linha por mês, mesmo batch_id).
//
// `valor_pagar` é o valor efetivamente lançado/editável pelo usuário — o
// cálculo de Vale-Transporte (Lei 7.418/1985: dias_uteis ×
// valor_passagem_dia) só serve como preenchimento automático no frontend
// (ponto de partida), não é recalculado/forçado pelo servidor.

import {
  jsonResponse, errorResponse, parseJsonBody, requireFields,
  assertNonNegativeNumber, assertMonth, assertYear, HttpError,
} from '../utils.js';

export async function listFuncionariaPayments(request, env, url) {
  const year = url.searchParams.get('year');
  let query = `
    SELECT fp.*, et.name AS expense_type_name, et.icon AS expense_type_icon
    FROM funcionaria_pagamentos fp
    JOIN funcionaria_expense_types et ON et.id = fp.expense_type_id
  `;
  const params = [];
  if (year) {
    query += ' WHERE fp.year = ?';
    params.push(assertYear(year));
  }
  query += ' ORDER BY fp.year DESC, fp.month DESC, et.name ASC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse(results);
}

export async function createFuncionariaPayments(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['expense_type_id', 'year', 'months', 'valor_pagar']);

  const expenseTypeId = Number(body.expense_type_id);
  const year = assertYear(body.year);
  const valorPagar = assertNonNegativeNumber(body.valor_pagar, 'valor_pagar');
  const diasUteis = body.dias_uteis !== undefined ? assertNonNegativeNumber(body.dias_uteis, 'dias_uteis') : 0;
  const valorPassagemDia = body.valor_passagem_dia !== undefined ? assertNonNegativeNumber(body.valor_passagem_dia, 'valor_passagem_dia') : 0;

  if (!Array.isArray(body.months) || body.months.length === 0) {
    throw new HttpError('O campo "months" deve ser uma lista com ao menos um mês.', 422);
  }
  const months = [...new Set(body.months.map((m) => assertMonth(m)))];

  const typeExists = await env.DB.prepare('SELECT id FROM funcionaria_expense_types WHERE id = ?')
    .bind(expenseTypeId).first();
  if (!typeExists) throw new HttpError('Tipo de despesa não encontrado.', 422);

  const conflicts = [];
  for (const month of months) {
    const existing = await env.DB.prepare(
      'SELECT id FROM funcionaria_pagamentos WHERE expense_type_id = ? AND year = ? AND month = ?'
    ).bind(expenseTypeId, year, month).first();
    if (existing) conflicts.push(month);
  }
  if (conflicts.length > 0) {
    return jsonResponse({
      error: `Já existe pagamento desta despesa nos meses: ${conflicts.join(', ')}.`,
      conflicts,
    }, 409);
  }

  const batchId = crypto.randomUUID();
  const created = [];
  for (const month of months) {
    const result = await env.DB.prepare(
      `INSERT INTO funcionaria_pagamentos
         (expense_type_id, year, month, dias_uteis, valor_passagem_dia, valor_pagar, batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(expenseTypeId, year, month, diasUteis, valorPassagemDia, valorPagar, batchId).run();
    created.push(result.meta.last_row_id);
  }

  const placeholders = created.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT fp.*, et.name AS expense_type_name, et.icon AS expense_type_icon
     FROM funcionaria_pagamentos fp JOIN funcionaria_expense_types et ON et.id = fp.expense_type_id
     WHERE fp.id IN (${placeholders})`
  ).bind(...created).all();

  return jsonResponse(results, 201);
}

export async function getFuncionariaPayment(request, env, id) {
  const record = await env.DB.prepare(
    `SELECT fp.*, et.name AS expense_type_name, et.icon AS expense_type_icon
     FROM funcionaria_pagamentos fp JOIN funcionaria_expense_types et ON et.id = fp.expense_type_id
     WHERE fp.id = ?`
  ).bind(id).first();
  if (!record) return errorResponse('Registro não encontrado.', 404);
  return jsonResponse(record);
}

export async function updateFuncionariaPayment(request, env, id) {
  const body = await parseJsonBody(request);

  const existing = await env.DB.prepare('SELECT * FROM funcionaria_pagamentos WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  const valorPagar = body.valor_pagar !== undefined ? assertNonNegativeNumber(body.valor_pagar, 'valor_pagar') : existing.valor_pagar;
  const diasUteis = body.dias_uteis !== undefined ? assertNonNegativeNumber(body.dias_uteis, 'dias_uteis') : existing.dias_uteis;
  const valorPassagemDia = body.valor_passagem_dia !== undefined ? assertNonNegativeNumber(body.valor_passagem_dia, 'valor_passagem_dia') : existing.valor_passagem_dia;

  await env.DB.prepare(
    `UPDATE funcionaria_pagamentos
     SET dias_uteis = ?, valor_passagem_dia = ?, valor_pagar = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).bind(diasUteis, valorPassagemDia, valorPagar, id).run();

  const updated = await env.DB.prepare(
    `SELECT fp.*, et.name AS expense_type_name, et.icon AS expense_type_icon
     FROM funcionaria_pagamentos fp JOIN funcionaria_expense_types et ON et.id = fp.expense_type_id
     WHERE fp.id = ?`
  ).bind(id).first();
  return jsonResponse(updated);
}

export async function deleteFuncionariaPayment(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM funcionaria_pagamentos WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);
  await env.DB.prepare('DELETE FROM funcionaria_pagamentos WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}
