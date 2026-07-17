// Rotas: /api/parametros-legais
// Tabelas oficiais (INSS, IRRF, FGTS, encargos, VT) parametrizadas por
// competência — nenhum percentual ou faixa fica fixo no código-fonte.
// Consultar worker/PAYROLL.md, seção "Atualização anual", antes de criar
// uma nova versão.

import { jsonResponse, errorResponse, parseJsonBody, requireFields, HttpError } from '../utils.js';

export async function listParametrosLegais(request, env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM parametros_legais ORDER BY competencia_inicio DESC'
  ).all();
  return jsonResponse(results);
}

/**
 * Retorna a linha de parametros_legais vigente para uma competência (a de
 * maior competencia_inicio que seja <= à competência informada). Usada
 * internamente pelo motor de cálculo da folha — não é uma rota HTTP.
 */
export async function buscarParametrosVigentes(env, competencia) {
  const row = await env.DB.prepare(
    `SELECT * FROM parametros_legais WHERE competencia_inicio <= ? ORDER BY competencia_inicio DESC LIMIT 1`
  ).bind(competencia).first();
  if (!row) return null;

  return {
    ...row,
    tabela_inss: JSON.parse(row.tabela_inss_json),
    tabela_irrf: JSON.parse(row.tabela_irrf_json),
  };
}

export async function getParametrosVigentes(request, env, url) {
  const competencia = url.searchParams.get('competencia');
  if (!competencia) throw new HttpError('Informe "competencia" (YYYY-MM-01).', 422);

  const parametros = await buscarParametrosVigentes(env, competencia);
  if (!parametros) {
    return errorResponse('Nenhum parâmetro legal vigente encontrado para esta competência.', 404);
  }
  return jsonResponse(parametros);
}

export async function createParametrosLegais(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, [
    'competencia_inicio', 'fonte_legal', 'tabela_inss_json', 'teto_inss',
    'tabela_irrf_json', 'deducao_dependente_irrf',
  ]);

  try {
    JSON.parse(body.tabela_inss_json);
    JSON.parse(body.tabela_irrf_json);
  } catch {
    throw new HttpError('tabela_inss_json / tabela_irrf_json devem ser JSON válido.', 422);
  }

  const existing = await env.DB.prepare('SELECT id FROM parametros_legais WHERE competencia_inicio = ?')
    .bind(body.competencia_inicio).first();
  if (existing) {
    return jsonResponse({ error: 'Já existe uma versão de parâmetros legais para esta competência_inicio.' }, 409);
  }

  const result = await env.DB.prepare(
    `INSERT INTO parametros_legais (
       competencia_inicio, fonte_legal, tabela_inss_json, teto_inss, tabela_irrf_json,
       deducao_dependente_irrf, desconto_simplificado_irrf,
       percentual_fgts, percentual_fgts_indenizatorio,
       percentual_inss_patronal, percentual_rat, percentual_vt_padrao
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.competencia_inicio, body.fonte_legal, body.tabela_inss_json, body.teto_inss, body.tabela_irrf_json,
    body.deducao_dependente_irrf, body.desconto_simplificado_irrf ?? 0,
    body.percentual_fgts ?? 0.08, body.percentual_fgts_indenizatorio ?? 0.032,
    body.percentual_inss_patronal ?? 0.08, body.percentual_rat ?? 0.008, body.percentual_vt_padrao ?? 0.06
  ).run();

  const created = await env.DB.prepare('SELECT * FROM parametros_legais WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  return jsonResponse(created, 201);
}
