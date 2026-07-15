// Rotas: /api/expense-types
// Categorias de despesas fixas, cadastráveis dinamicamente pelo usuário
// (modal "Nova despesa" no frontend).

import { jsonResponse, errorResponse, parseJsonBody, requireFields, HttpError } from '../utils.js';

export async function listExpenseTypes(request, env) {
  const { results } = await env.DB.prepare('SELECT * FROM expense_types ORDER BY name ASC').all();
  return jsonResponse(results);
}

export async function createExpenseType(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['name']);
  const name = String(body.name).trim();
  if (!name) throw new HttpError('O campo "name" não pode ser vazio.', 422);

  const existing = await env.DB.prepare('SELECT * FROM expense_types WHERE name = ?').bind(name).first();
  if (existing) {
    return jsonResponse({ error: 'Já existe um tipo de despesa com esse nome.', record: existing }, 409);
  }

  const result = await env.DB.prepare(
    'INSERT INTO expense_types (name, icon) VALUES (?, ?)'
  ).bind(name, body.icon ?? null).run();

  const created = await env.DB.prepare('SELECT * FROM expense_types WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  return jsonResponse(created, 201);
}

export async function deleteExpenseType(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM expense_types WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  const inUse = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM fixed_expenses WHERE expense_type_id = ?'
  ).bind(id).first();
  if (inUse.count > 0) {
    return errorResponse('Não é possível excluir: existem despesas fixas cadastradas com este tipo.', 409);
  }

  await env.DB.prepare('DELETE FROM expense_types WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}
