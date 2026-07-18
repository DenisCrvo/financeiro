// Rotas: /api/funcionaria-expense-types
// Categorias de despesa da seção Funcionária — Pagamento Mensal,
// cadastráveis dinamicamente pelo usuário. Independente de `expense_types`
// (usado por Despesas Fixas) para que as duas listas não se misturem.

import { jsonResponse, errorResponse, parseJsonBody, requireFields, HttpError } from '../utils.js';

export async function listFuncionariaExpenseTypes(request, env) {
  const { results } = await env.DB.prepare('SELECT * FROM funcionaria_expense_types ORDER BY name ASC').all();
  return jsonResponse(results);
}

export async function createFuncionariaExpenseType(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['name']);
  const name = String(body.name).trim();
  if (!name) throw new HttpError('O campo "name" não pode ser vazio.', 422);

  const existing = await env.DB.prepare('SELECT * FROM funcionaria_expense_types WHERE name = ?').bind(name).first();
  if (existing) {
    return jsonResponse({ error: 'Já existe um tipo de despesa com esse nome.', record: existing }, 409);
  }

  const result = await env.DB.prepare(
    'INSERT INTO funcionaria_expense_types (name, icon) VALUES (?, ?)'
  ).bind(name, body.icon ?? null).run();

  const created = await env.DB.prepare('SELECT * FROM funcionaria_expense_types WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  return jsonResponse(created, 201);
}

export async function updateFuncionariaExpenseType(request, env, id) {
  const body = await parseJsonBody(request);
  requireFields(body, ['name']);
  const name = String(body.name).trim();
  if (!name) throw new HttpError('O campo "name" não pode ser vazio.', 422);

  const existing = await env.DB.prepare('SELECT * FROM funcionaria_expense_types WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  const duplicate = await env.DB.prepare('SELECT id FROM funcionaria_expense_types WHERE name = ? AND id != ?')
    .bind(name, id).first();
  if (duplicate) {
    return jsonResponse({ error: 'Já existe um tipo de despesa com esse nome.' }, 409);
  }

  await env.DB.prepare('UPDATE funcionaria_expense_types SET name = ?, icon = ? WHERE id = ?')
    .bind(name, body.icon ?? existing.icon, id).run();

  const updated = await env.DB.prepare('SELECT * FROM funcionaria_expense_types WHERE id = ?').bind(id).first();
  return jsonResponse(updated);
}

export async function deleteFuncionariaExpenseType(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM funcionaria_expense_types WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  const inUse = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM funcionaria_pagamentos WHERE expense_type_id = ?'
  ).bind(id).first();
  if (inUse.count > 0) {
    return errorResponse('Não é possível excluir: existem pagamentos cadastrados com este tipo.', 409);
  }

  await env.DB.prepare('DELETE FROM funcionaria_expense_types WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}
