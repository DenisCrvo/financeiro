// Rotas: /api/funcionarios
// Identificação mínima da(s) empregada(s) doméstica(s) — o foco do sistema
// é o processamento financeiro da folha, não um cadastro de RH completo.
// Por isso só o nome é obrigatório; CPF/NIS/data de admissão/cargo/
// dependentes são opcionais e podem ser preenchidos depois (edição), quando
// forem necessários (ex.: para uma futura integração com o eSocial).

import { jsonResponse, errorResponse, parseJsonBody, requireFields, HttpError } from '../utils.js';

/** Valida o formato do CPF apenas quando ele é informado (campo opcional). */
function normalizeCpf(cpf) {
  if (!cpf) return null;
  const digits = String(cpf).replace(/\D/g, '');
  if (digits.length !== 11) {
    throw new HttpError('CPF deve conter 11 dígitos (ou deixe em branco).', 422);
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
  requireFields(body, ['nome']);
  const nome = String(body.nome).trim();
  if (!nome) throw new HttpError('O campo "nome" não pode ser vazio.', 422);

  const cpf = normalizeCpf(body.cpf);
  if (cpf) {
    const existing = await env.DB.prepare('SELECT id FROM funcionarios WHERE cpf = ?').bind(cpf).first();
    if (existing) {
      return jsonResponse({ error: 'Já existe uma funcionária cadastrada com este CPF.' }, 409);
    }
  }

  const dependentes = body.dependentes_irrf !== undefined ? Number(body.dependentes_irrf) : 0;
  if (!Number.isInteger(dependentes) || dependentes < 0) {
    throw new HttpError('dependentes_irrf deve ser um inteiro maior ou igual a zero.', 422);
  }

  const result = await env.DB.prepare(
    `INSERT INTO funcionarios (nome, cpf, nis, data_admissao, cargo, categoria_esocial, dependentes_irrf)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    nome, cpf, body.nis || null, body.data_admissao || null,
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

  let cpf = existing.cpf;
  if (body.cpf !== undefined) {
    cpf = normalizeCpf(body.cpf);
    if (cpf) {
      const duplicate = await env.DB.prepare('SELECT id FROM funcionarios WHERE cpf = ? AND id != ?')
        .bind(cpf, id).first();
      if (duplicate) return jsonResponse({ error: 'Já existe uma funcionária cadastrada com este CPF.' }, 409);
    }
  }

  await env.DB.prepare(
    `UPDATE funcionarios SET
       nome = ?, cpf = ?, nis = ?, data_admissao = ?, cargo = ?, categoria_esocial = ?, dependentes_irrf = ?,
       situacao = ?, data_desligamento = ?, atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).bind(
    body.nome?.trim() || existing.nome,
    cpf,
    body.nis !== undefined ? (body.nis || null) : existing.nis,
    body.data_admissao !== undefined ? (body.data_admissao || null) : existing.data_admissao,
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
