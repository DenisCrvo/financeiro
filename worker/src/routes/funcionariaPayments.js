// Rotas: /api/funcionaria-payments
// Pagamento mensal à funcionária (empregada doméstica), no mesmo formato de
// lançamento em lote de fixed_expenses ("months": [1,2,3] → uma linha por
// mês, mesmo batch_id), incluindo o cálculo do Vale-Transporte
// (Lei 7.418/1985): valor_vt = dias_uteis × valor_passagem_dia (a passagem
// já é o valor de ida+volta), valor_total = salario + valor_vt.

import {
  jsonResponse, errorResponse, parseJsonBody, requireFields,
  assertNonNegativeNumber, assertMonth, assertYear, HttpError,
} from '../utils.js';

// Vale-Transporte (Lei 7.418/1985): valor_passagem_dia já é o custo de
// ida+volta, então o total do benefício é simplesmente dias × valor/dia.
function calcularValeTransporte({ diasUteis, valorPassagemDia, salario }) {
  const valorVt = Math.round(diasUteis * valorPassagemDia * 100) / 100;
  const valorTotal = Math.round((salario + valorVt) * 100) / 100;
  return { valorVt, valorTotal };
}

export async function listFuncionariaPayments(request, env, url) {
  const year = url.searchParams.get('year');
  let query = 'SELECT * FROM funcionaria_pagamentos';
  const params = [];
  if (year) {
    query += ' WHERE year = ?';
    params.push(assertYear(year));
  }
  query += ' ORDER BY year DESC, month DESC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse(results);
}

export async function createFuncionariaPayments(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['year', 'months', 'salario']);

  const year = assertYear(body.year);
  const salario = assertNonNegativeNumber(body.salario, 'salario');
  const diasUteis = body.dias_uteis !== undefined ? assertNonNegativeNumber(body.dias_uteis, 'dias_uteis') : 0;
  const valorPassagemDia = body.valor_passagem_dia !== undefined ? assertNonNegativeNumber(body.valor_passagem_dia, 'valor_passagem_dia') : 0;
  const nome = body.nome ? String(body.nome).trim() : null;
  const description = body.description ? String(body.description).trim() : null;

  if (!Array.isArray(body.months) || body.months.length === 0) {
    throw new HttpError('O campo "months" deve ser uma lista com ao menos um mês.', 422);
  }
  const months = [...new Set(body.months.map((m) => assertMonth(m)))];

  const { valorVt, valorTotal } = calcularValeTransporte({ diasUteis, valorPassagemDia, salario });

  const conflicts = [];
  for (const month of months) {
    const existing = await env.DB.prepare(
      'SELECT id FROM funcionaria_pagamentos WHERE year = ? AND month = ?'
    ).bind(year, month).first();
    if (existing) conflicts.push(month);
  }
  if (conflicts.length > 0) {
    return jsonResponse({
      error: `Já existe pagamento lançado nos meses: ${conflicts.join(', ')}.`,
      conflicts,
    }, 409);
  }

  const batchId = crypto.randomUUID();
  const created = [];
  for (const month of months) {
    const result = await env.DB.prepare(
      `INSERT INTO funcionaria_pagamentos
         (nome, year, month, salario, dias_uteis, valor_passagem_dia, valor_vt, valor_total, description, batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(nome, year, month, salario, diasUteis, valorPassagemDia, valorVt, valorTotal, description, batchId).run();
    created.push(result.meta.last_row_id);
  }

  const placeholders = created.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT * FROM funcionaria_pagamentos WHERE id IN (${placeholders})`
  ).bind(...created).all();

  return jsonResponse(results, 201);
}

export async function getFuncionariaPayment(request, env, id) {
  const record = await env.DB.prepare('SELECT * FROM funcionaria_pagamentos WHERE id = ?').bind(id).first();
  if (!record) return errorResponse('Registro não encontrado.', 404);
  return jsonResponse(record);
}

export async function updateFuncionariaPayment(request, env, id) {
  const body = await parseJsonBody(request);

  const existing = await env.DB.prepare('SELECT * FROM funcionaria_pagamentos WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  const salario = body.salario !== undefined ? assertNonNegativeNumber(body.salario, 'salario') : existing.salario;
  const diasUteis = body.dias_uteis !== undefined ? assertNonNegativeNumber(body.dias_uteis, 'dias_uteis') : existing.dias_uteis;
  const valorPassagemDia = body.valor_passagem_dia !== undefined ? assertNonNegativeNumber(body.valor_passagem_dia, 'valor_passagem_dia') : existing.valor_passagem_dia;
  const nome = body.nome !== undefined ? (String(body.nome).trim() || null) : existing.nome;
  const description = body.description !== undefined ? (String(body.description).trim() || null) : existing.description;

  const { valorVt, valorTotal } = calcularValeTransporte({ diasUteis, valorPassagemDia, salario });

  await env.DB.prepare(
    `UPDATE funcionaria_pagamentos
     SET nome = ?, salario = ?, dias_uteis = ?, valor_passagem_dia = ?, valor_vt = ?, valor_total = ?, description = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).bind(nome, salario, diasUteis, valorPassagemDia, valorVt, valorTotal, description, id).run();

  const updated = await env.DB.prepare('SELECT * FROM funcionaria_pagamentos WHERE id = ?').bind(id).first();
  return jsonResponse(updated);
}

export async function deleteFuncionariaPayment(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM funcionaria_pagamentos WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);
  await env.DB.prepare('DELETE FROM funcionaria_pagamentos WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}
