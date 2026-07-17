// Rotas: /api/funcionarios
// Cadastro mínimo de identificação da(s) empregada(s) doméstica(s), exigido
// pelo eSocial (equivalente aos dados cadastrais dos eventos S-2200/S-2205).
// Este NÃO é um módulo de lançamento — apenas identificação estável,
// referenciada pelo módulo de Folha de Pagamento via funcionaria_id.

import { jsonResponse, errorResponse, parseJsonBody, requireFields, HttpError } from '../utils.js';

function validateCpf(cpf) {
  const digits = String(cpf).replace(/\D/g, '');
  if (digits.length !== 11) {
    throw new HttpError('CPF deve conter 11 dígitos.', 422);
  }
  return digits;
}

export async function listFuncionarios(request, env, url) {
  const situacao = url.searchParams.get('situacao');
  let query = 'SELECT * FROM funcionarios';
  const params = [];
  if (situacao) {
    query += ' WHERE situacao = ?';
    params.push(situacao);
  }
  query += ' ORDER BY nome ASC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse(results);
}

export async function getFuncionario(request, env, id) {
  const record = await env.DB.prepare('SELECT * FROM funcionarios WHERE id = ?').bind(id).first();
  if (!record) return errorResponse('Registro não encontrado.', 404);
  return jsonResponse(record);
}

export async function createFuncionario(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['nome', 'cpf', 'data_admissao']);
  const cpf = validateCpf(body.cpf);

  const existing = await env.DB.prepare('SELECT id FROM funcionarios WHERE cpf = ?').bind(cpf).first();
  if (existing) {
    return jsonResponse({ error: 'Já existe uma funcionária cadastrada com este CPF.' }, 409);
  }

  const dependentes = Number.isInteger(Number(body.dependentes_irrf)) ? Number(body.dependentes_irrf) : 0;
  if (dependentes < 0) throw new HttpError('dependentes_irrf não pode ser negativo.', 422);

  const result = await env.DB.prepare(
    `INSERT INTO funcionarios (nome, cpf, nis, data_admissao, cargo, categoria_esocial, dependentes_irrf)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    String(body.nome).trim(), cpf, body.nis ?? null, body.data_admissao,
    body.cargo?.trim() || 'Empregado(a) Doméstico(a)', body.categoria_esocial ?? '104', dependentes
  ).run();

  const created = await env.DB.prepare('SELECT * FROM funcionarios WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  return jsonResponse(created, 201);
}

export async function updateFuncionario(request, env, id) {
  const body = await parseJsonBody(request);
  const existing = await env.DB.prepare('SELECT * FROM funcionarios WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  const situacao = body.situacao ?? existing.situacao;
  if (!['ativo', 'afastado', 'desligado'].includes(situacao)) {
    throw new HttpError('situacao deve ser "ativo", "afastado" ou "desligado".', 422);
  }
  if (situacao === 'desligado' && !body.data_desligamento && !existing.data_desligamento) {
    throw new HttpError('data_desligamento é obrigatória ao desligar a funcionária.', 422);
  }

  const dependentes = body.dependentes_irrf !== undefined ? Number(body.dependentes_irrf) : existing.dependentes_irrf;
  if (!Number.isInteger(dependentes) || dependentes < 0) {
    throw new HttpError('dependentes_irrf deve ser um inteiro maior ou igual a zero.', 422);
  }

  await env.DB.prepare(
    `UPDATE funcionarios SET
       nome = ?, nis = ?, cargo = ?, categoria_esocial = ?, dependentes_irrf = ?,
       situacao = ?, data_desligamento = ?, atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).bind(
    body.nome?.trim() || existing.nome,
    body.nis !== undefined ? body.nis : existing.nis,
    body.cargo?.trim() || existing.cargo,
    body.categoria_esocial ?? existing.categoria_esocial,
    dependentes,
    situacao,
    body.data_desligamento ?? existing.data_desligamento,
    id
  ).run();

  const updated = await env.DB.prepare('SELECT * FROM funcionarios WHERE id = ?').bind(id).first();
  return jsonResponse(updated);
}

export async function deleteFuncionario(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM funcionarios WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  const emUso = await env.DB.prepare('SELECT COUNT(*) as count FROM folha_pagamento WHERE funcionaria_id = ?')
    .bind(id).first();
  if (emUso.count > 0) {
    return errorResponse('Não é possível excluir: existem folhas de pagamento vinculadas a esta funcionária.', 409);
  }

  await env.DB.prepare('DELETE FROM funcionarios WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}
