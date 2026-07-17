// Rotas: /api/rubricas
// Estrutura equivalente ao evento S-1010 do eSocial (Tabela de Rubricas).
// Toda regra de incidência (INSS/IRRF/FGTS) é dado, não código-fonte.

import { jsonResponse, errorResponse, parseJsonBody, requireFields, HttpError } from '../utils.js';

const TIPOS_VALIDOS = ['provento', 'desconto'];

function toBit(value) {
  return value ? 1 : 0;
}

export async function listRubricas(request, env, url) {
  const apenasAtivas = url.searchParams.get('ativo');
  let query = 'SELECT * FROM rubricas';
  const params = [];
  if (apenasAtivas !== null) {
    query += ' WHERE ativo = ?';
    params.push(apenasAtivas === 'true' ? 1 : 0);
  }
  query += ' ORDER BY codigo ASC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse(results);
}

export async function createRubrica(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['codigo', 'descricao', 'natureza_esocial', 'tipo']);
  if (!TIPOS_VALIDOS.includes(body.tipo)) {
    throw new HttpError(`"tipo" deve ser um dos valores: ${TIPOS_VALIDOS.join(', ')}`, 422);
  }

  const existing = await env.DB.prepare('SELECT id FROM rubricas WHERE codigo = ?').bind(body.codigo).first();
  if (existing) return jsonResponse({ error: 'Já existe uma rubrica com este código.' }, 409);

  const result = await env.DB.prepare(
    `INSERT INTO rubricas (codigo, descricao, natureza_esocial, tipo, incidencia_inss, incidencia_irrf, incidencia_fgts, ativo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  ).bind(
    body.codigo, body.descricao, body.natureza_esocial, body.tipo,
    toBit(body.incidencia_inss), toBit(body.incidencia_irrf), toBit(body.incidencia_fgts)
  ).run();

  const created = await env.DB.prepare('SELECT * FROM rubricas WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  return jsonResponse(created, 201);
}

export async function updateRubrica(request, env, id) {
  const body = await parseJsonBody(request);
  const existing = await env.DB.prepare('SELECT * FROM rubricas WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  await env.DB.prepare(
    `UPDATE rubricas SET descricao = ?, incidencia_inss = ?, incidencia_irrf = ?, incidencia_fgts = ?, ativo = ?
     WHERE id = ?`
  ).bind(
    body.descricao ?? existing.descricao,
    body.incidencia_inss !== undefined ? toBit(body.incidencia_inss) : existing.incidencia_inss,
    body.incidencia_irrf !== undefined ? toBit(body.incidencia_irrf) : existing.incidencia_irrf,
    body.incidencia_fgts !== undefined ? toBit(body.incidencia_fgts) : existing.incidencia_fgts,
    body.ativo !== undefined ? toBit(body.ativo) : existing.ativo,
    id
  ).run();

  const updated = await env.DB.prepare('SELECT * FROM rubricas WHERE id = ?').bind(id).first();
  return jsonResponse(updated);
}
