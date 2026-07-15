// Rotas: /api/employee
// Lançamento mensal único por (year, month). O valor de vale-transporte é
// calculado no frontend (dias x valor diário) e enviado pronto para persistir.

import {
  jsonResponse, errorResponse, parseJsonBody, requireFields,
  assertNonNegativeNumber, assertMonth, assertYear, HttpError,
} from '../utils.js';

function nonNegInt(value, fieldName) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw new HttpError(`O campo "${fieldName}" deve ser um inteiro maior ou igual a zero.`, 422);
  }
  return num;
}

export async function listEmployeeMonthly(request, env, url) {
  const year = url.searchParams.get('year');
  let query = 'SELECT * FROM employee_monthly';
  const params = [];
  if (year) {
    query += ' WHERE year = ?';
    params.push(assertYear(year));
  }
  query += ' ORDER BY year DESC, month DESC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse(results);
}

export async function checkEmployeeMonthly(request, env, url) {
  const year = assertYear(url.searchParams.get('year'));
  const month = assertMonth(url.searchParams.get('month'));
  const existing = await env.DB.prepare(
    'SELECT * FROM employee_monthly WHERE year = ? AND month = ?'
  ).bind(year, month).first();
  return jsonResponse({ exists: !!existing, record: existing ?? null });
}

export async function createEmployeeMonthly(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['year', 'month', 'days_worked', 'daily_transport_value', 'transport_value']);
  const year = assertYear(body.year);
  const month = assertMonth(body.month);
  const daysWorked = nonNegInt(body.days_worked, 'days_worked');
  const dailyTransportValue = assertNonNegativeNumber(body.daily_transport_value, 'daily_transport_value');
  const transportValue = assertNonNegativeNumber(body.transport_value, 'transport_value');
  const vacationValue = assertNonNegativeNumber(body.vacation_value ?? 0, 'vacation_value');
  const thirteenthValue = assertNonNegativeNumber(body.thirteenth_value ?? 0, 'thirteenth_value');
  const advanceDiscountValue = assertNonNegativeNumber(body.advance_discount_value ?? 0, 'advance_discount_value');
  const advanceDiscountMonths = nonNegInt(body.advance_discount_months ?? 0, 'advance_discount_months');
  const esocialValue = assertNonNegativeNumber(body.esocial_value ?? 0, 'esocial_value');

  const existing = await env.DB.prepare(
    'SELECT id FROM employee_monthly WHERE year = ? AND month = ?'
  ).bind(year, month).first();
  if (existing) {
    return jsonResponse({ error: 'Já existe lançamento para este mês.', record: existing }, 409);
  }

  const result = await env.DB.prepare(
    `INSERT INTO employee_monthly
       (year, month, days_worked, daily_transport_value, transport_value,
        vacation_value, thirteenth_value, advance_discount_value, advance_discount_months, esocial_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    year, month, daysWorked, dailyTransportValue, transportValue,
    vacationValue, thirteenthValue, advanceDiscountValue, advanceDiscountMonths, esocialValue
  ).run();

  const created = await env.DB.prepare('SELECT * FROM employee_monthly WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  return jsonResponse(created, 201);
}

export async function updateEmployeeMonthly(request, env, id) {
  const body = await parseJsonBody(request);
  const existing = await env.DB.prepare('SELECT * FROM employee_monthly WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  const daysWorked = nonNegInt(body.days_worked ?? existing.days_worked, 'days_worked');
  const dailyTransportValue = assertNonNegativeNumber(body.daily_transport_value ?? existing.daily_transport_value, 'daily_transport_value');
  const transportValue = assertNonNegativeNumber(body.transport_value ?? existing.transport_value, 'transport_value');
  const vacationValue = assertNonNegativeNumber(body.vacation_value ?? existing.vacation_value, 'vacation_value');
  const thirteenthValue = assertNonNegativeNumber(body.thirteenth_value ?? existing.thirteenth_value, 'thirteenth_value');
  const advanceDiscountValue = assertNonNegativeNumber(body.advance_discount_value ?? existing.advance_discount_value, 'advance_discount_value');
  const advanceDiscountMonths = nonNegInt(body.advance_discount_months ?? existing.advance_discount_months, 'advance_discount_months');
  const esocialValue = assertNonNegativeNumber(body.esocial_value ?? existing.esocial_value, 'esocial_value');

  await env.DB.prepare(
    `UPDATE employee_monthly SET
       days_worked = ?, daily_transport_value = ?, transport_value = ?,
       vacation_value = ?, thirteenth_value = ?, advance_discount_value = ?,
       advance_discount_months = ?, esocial_value = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).bind(
    daysWorked, dailyTransportValue, transportValue,
    vacationValue, thirteenthValue, advanceDiscountValue, advanceDiscountMonths, esocialValue, id
  ).run();

  const updated = await env.DB.prepare('SELECT * FROM employee_monthly WHERE id = ?').bind(id).first();
  return jsonResponse(updated);
}

export async function deleteEmployeeMonthly(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM employee_monthly WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);
  await env.DB.prepare('DELETE FROM employee_monthly WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}
