// Rotas: /api/folha
// Processamento da Folha de Pagamento. A regra de negócio (cálculo) fica
// inteiramente em src/domain/folhaCalculationEngine.js — esta camada só
// carrega os dados necessários (funcionária, rubricas ativas, parâmetros
// legais vigentes), aciona o motor e persiste o resultado.

import { jsonResponse, errorResponse, parseJsonBody, requireFields, assertYear, HttpError } from '../utils.js';
import { calcularFolha } from '../domain/folhaCalculationEngine.js';
import { buscarParametrosVigentes } from './parametrosLegais.js';

const VERBA_FIELDS = [
  'salario_base', 'horas_extras', 'adicional_noturno', 'insalubridade',
  'periculosidade', 'comissoes', 'outras_verbas', 'descontos',
];

function competenciaToDate(competencia) {
  // Aceita "YYYY-MM" ou "YYYY-MM-01" e normaliza para o primeiro dia do mês.
  const match = /^(\d{4})-(\d{2})/.exec(String(competencia));
  if (!match) throw new HttpError('competencia deve estar no formato YYYY-MM.', 422);
  return `${match[1]}-${match[2]}-01`;
}

/** Traduz o RAISE(ABORT, ...) dos triggers de imutabilidade em erro 409 amigável. */
function isFolhaFechadaError(err) {
  return /fechad[ao] não pode ser/i.test(err.message || '');
}

async function carregarRubricasAtivas(env) {
  const { results } = await env.DB.prepare('SELECT * FROM rubricas WHERE ativo = 1').all();
  const mapa = new Map();
  for (const r of results) {
    mapa.set(r.codigo, {
      id: r.id,
      incidencia_inss: !!r.incidencia_inss,
      incidencia_irrf: !!r.incidencia_irrf,
      incidencia_fgts: !!r.incidencia_fgts,
    });
  }
  return mapa;
}

async function montarResultadoCompleto(env, folha) {
  const rubricas = await env.DB.prepare(
    `SELECT fr.id, fr.valor, r.codigo, r.descricao, r.tipo
     FROM folha_rubricas fr JOIN rubricas r ON r.id = fr.rubrica_id
     WHERE fr.folha_id = ? ORDER BY fr.id`
  ).bind(folha.id).all();

  const lancamentos = await env.DB.prepare(
    'SELECT * FROM folha_lancamentos_financeiros WHERE folha_id = ? ORDER BY id'
  ).bind(folha.id).all();

  return { ...folha, rubricas: rubricas.results, lancamentos_financeiros: lancamentos.results };
}

export async function listFolhas(request, env, url) {
  const funcionariaId = url.searchParams.get('funcionaria_id');
  const year = url.searchParams.get('year');
  const conditions = [];
  const params = [];
  if (funcionariaId) { conditions.push('fp.funcionaria_id = ?'); params.push(Number(funcionariaId)); }
  if (year) { conditions.push("strftime('%Y', fp.competencia) = ?"); params.push(String(assertYear(year))); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT fp.*, f.nome AS funcionaria_nome
     FROM folha_pagamento fp JOIN funcionarios f ON f.id = fp.funcionaria_id
     ${where} ORDER BY fp.competencia DESC, f.nome ASC`
  ).bind(...params).all();

  return jsonResponse(results);
}

export async function getFolha(request, env, id) {
  const folha = await env.DB.prepare(
    `SELECT fp.*, f.nome AS funcionaria_nome, f.cpf AS funcionaria_cpf
     FROM folha_pagamento fp JOIN funcionarios f ON f.id = fp.funcionaria_id
     WHERE fp.id = ?`
  ).bind(id).first();
  if (!folha) return errorResponse('Registro não encontrado.', 404);

  return jsonResponse(await montarResultadoCompleto(env, folha));
}

export async function processarFolha(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['funcionaria_id', 'competencia', 'salario_base', 'dias_uteis', 'valor_passagem_dia']);

  const funcionariaId = Number(body.funcionaria_id);
  const competencia = competenciaToDate(body.competencia);

  const funcionaria = await env.DB.prepare('SELECT * FROM funcionarios WHERE id = ?').bind(funcionariaId).first();
  if (!funcionaria) throw new HttpError('Funcionária não encontrada.', 422);

  const jaExiste = await env.DB.prepare(
    'SELECT id FROM folha_pagamento WHERE funcionaria_id = ? AND competencia = ?'
  ).bind(funcionariaId, competencia).first();
  if (jaExiste) {
    return jsonResponse({ error: 'Já existe folha processada para esta funcionária nesta competência.', record: jaExiste }, 409);
  }

  const parametrosLegais = await buscarParametrosVigentes(env, competencia);
  if (!parametrosLegais) {
    throw new HttpError(
      `Nenhum parâmetro legal cadastrado para a competência ${competencia}. Cadastre em /api/parametros-legais antes de processar a folha.`,
      422
    );
  }

  const rubricasPorCodigo = await carregarRubricasAtivas(env);

  const verbas = {};
  for (const field of VERBA_FIELDS) {
    const valor = Number(body[field] ?? 0);
    if (Number.isNaN(valor) || valor < 0) {
      throw new HttpError(`O campo "${field}" deve ser um número maior ou igual a zero.`, 422);
    }
    verbas[field] = valor;
  }

  const diasUteis = Number(body.dias_uteis);
  const valorPassagemDia = Number(body.valor_passagem_dia);
  if (!Number.isInteger(diasUteis) || diasUteis < 0) throw new HttpError('dias_uteis deve ser um inteiro >= 0.', 422);
  if (Number.isNaN(valorPassagemDia) || valorPassagemDia < 0) throw new HttpError('valor_passagem_dia deve ser >= 0.', 422);

  const percentualDescontoVt = body.percentual_desconto_vt !== undefined
    ? Number(body.percentual_desconto_vt)
    : parametrosLegais.percentual_vt_padrao;

  const resultado = calcularFolha({
    verbas,
    vt: { dias_uteis: diasUteis, valor_passagem_dia: valorPassagemDia, percentual_desconto_vt: percentualDescontoVt },
    dependentesIrrf: funcionaria.dependentes_irrf,
    rubricasPorCodigo,
    parametrosLegais,
  });

  const insertResult = await env.DB.prepare(
    `INSERT INTO folha_pagamento (
       funcionaria_id, competencia, salario_base, horas_extras, adicional_noturno, insalubridade,
       periculosidade, comissoes, outras_verbas, descontos, dias_uteis, valor_passagem_dia,
       percentual_desconto_vt, valor_vt_depositado, desconto_vt, salario_bruto,
       base_inss, valor_inss, base_irrf, valor_irrf, base_fgts, valor_fgts, valor_fgts_indenizatorio,
       encargos_empregador, salario_liquido, parametros_legais_id, status, data_processamento
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberta', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
  ).bind(
    funcionariaId, competencia, verbas.salario_base, verbas.horas_extras, verbas.adicional_noturno, verbas.insalubridade,
    verbas.periculosidade, verbas.comissoes, verbas.outras_verbas, verbas.descontos, diasUteis, valorPassagemDia,
    resultado.percentual_desconto_vt, resultado.valor_vt_depositado, resultado.desconto_vt, resultado.salario_bruto,
    resultado.base_inss, resultado.valor_inss, resultado.base_irrf, resultado.valor_irrf,
    resultado.base_fgts, resultado.valor_fgts, resultado.valor_fgts_indenizatorio,
    resultado.encargos_empregador, resultado.salario_liquido, parametrosLegais.id
  ).run();

  const folhaId = insertResult.meta.last_row_id;
  for (const item of resultado.rubricasFolha) {
    await env.DB.prepare('INSERT INTO folha_rubricas (folha_id, rubrica_id, valor) VALUES (?, ?, ?)')
      .bind(folhaId, item.rubrica_id, item.valor).run();
  }

  const folha = await env.DB.prepare(
    `SELECT fp.*, f.nome AS funcionaria_nome FROM folha_pagamento fp
     JOIN funcionarios f ON f.id = fp.funcionaria_id WHERE fp.id = ?`
  ).bind(folhaId).first();

  return jsonResponse(await montarResultadoCompleto(env, folha), 201);
}

export async function fecharFolha(request, env, id) {
  const folha = await env.DB.prepare('SELECT * FROM folha_pagamento WHERE id = ?').bind(id).first();
  if (!folha) return errorResponse('Registro não encontrado.', 404);
  if (folha.status === 'fechada') {
    return errorResponse('Esta folha já está fechada.', 409);
  }

  await env.DB.prepare(
    `UPDATE folha_pagamento SET status = 'fechada', atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).bind(id).run();

  // Integração financeira — Lei Complementar 150/2015: o salário deve ser
  // pago até o 5º dia útil do mês subsequente (art. 18, CLT, aplicável
  // subsidiariamente); aqui registramos a data do fechamento como referência.
  const hoje = new Date().toISOString();
  const custoEmpregadorVt = Math.round((folha.valor_vt_depositado - folha.desconto_vt + Number.EPSILON) * 100) / 100;
  const totalEncargos = Math.round(
    (folha.encargos_empregador + folha.valor_fgts + folha.valor_fgts_indenizatorio + Number.EPSILON) * 100
  ) / 100;

  const lancamentos = [
    { tipo: 'salario', valor: folha.salario_liquido, descricao: `Salário líquido — competência ${folha.competencia.slice(0, 7)}` },
    { tipo: 'vale_transporte', valor: custoEmpregadorVt, descricao: `Custeio de Vale-Transporte — competência ${folha.competencia.slice(0, 7)}` },
    { tipo: 'encargos_empregador', valor: totalEncargos, descricao: `INSS patronal + RAT + FGTS + FGTS indenizatório — competência ${folha.competencia.slice(0, 7)}` },
  ];

  for (const lanc of lancamentos) {
    await env.DB.prepare(
      `INSERT INTO folha_lancamentos_financeiros (folha_id, tipo, valor, descricao, data_lancamento)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, lanc.tipo, lanc.valor, lanc.descricao, hoje).run();
  }

  const folhaAtualizada = await env.DB.prepare(
    `SELECT fp.*, f.nome AS funcionaria_nome FROM folha_pagamento fp
     JOIN funcionarios f ON f.id = fp.funcionaria_id WHERE fp.id = ?`
  ).bind(id).first();

  return jsonResponse(await montarResultadoCompleto(env, folhaAtualizada));
}

export async function deleteFolha(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM folha_pagamento WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  try {
    await env.DB.prepare('DELETE FROM folha_pagamento WHERE id = ?').bind(id).run();
  } catch (err) {
    if (isFolhaFechadaError(err)) {
      return errorResponse('Folha fechada não pode ser excluída — o histórico é imutável para auditoria.', 409);
    }
    throw err;
  }
  return jsonResponse({ success: true });
}
