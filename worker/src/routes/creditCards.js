// Rotas: /api/credit-cards
// Regra de negócio: uma fatura por (card_name, year, month). Ao tentar
// cadastrar um mês já existente, a API retorna 409 com o valor atual para
// o frontend decidir entre "Atualizar" (PUT) ou "Manter" (cancelar).

import {
  jsonResponse, errorResponse, parseJsonBody, requireFields,
  assertNonNegativeNumber, assertMonth, assertYear, HttpError,
} from '../utils.js';

const VALID_CARDS = ['bradesco', 'nubank'];

function validateCardName(cardName) {
  if (!VALID_CARDS.includes(cardName)) {
    throw new HttpError(`card_name deve ser um dos valores: ${VALID_CARDS.join(', ')}`, 422);
  }
}

export async function listCreditCards(request, env, url) {
  const year = url.searchParams.get('year');
  let query = 'SELECT * FROM credit_cards';
  const params = [];
  if (year) {
    query += ' WHERE year = ?';
    params.push(assertYear(year));
  }
  query += ' ORDER BY year DESC, month DESC, card_name ASC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse(results);
}

export async function checkCreditCard(request, env, url) {
  const cardName = url.searchParams.get('card_name');
  const year = assertYear(url.searchParams.get('year'));
  const month = assertMonth(url.searchParams.get('month'));
  validateCardName(cardName);

  const existing = await env.DB.prepare(
    'SELECT * FROM credit_cards WHERE card_name = ? AND year = ? AND month = ?'
  ).bind(cardName, year, month).first();

  return jsonResponse({ exists: !!existing, record: existing ?? null });
}

export async function createCreditCard(request, env) {
  const body = await parseJsonBody(request);
  requireFields(body, ['card_name', 'year', 'month', 'value']);
  validateCardName(body.card_name);
  const year = assertYear(body.year);
  const month = assertMonth(body.month);
  const value = assertNonNegativeNumber(body.value, 'value');

  const existing = await env.DB.prepare(
    'SELECT * FROM credit_cards WHERE card_name = ? AND year = ? AND month = ?'
  ).bind(body.card_name, year, month).first();

  if (existing) {
    return jsonResponse(
      { error: 'Já existe lançamento para este cartão/mês.', record: existing },
      409
    );
  }

  const result = await env.DB.prepare(
    `INSERT INTO credit_cards (card_name, year, month, value)
     VALUES (?, ?, ?, ?)`
  ).bind(body.card_name, year, month, value).run();

  const created = await env.DB.prepare('SELECT * FROM credit_cards WHERE id = ?')
    .bind(result.meta.last_row_id).first();

  return jsonResponse(created, 201);
}

export async function updateCreditCard(request, env, id) {
  const body = await parseJsonBody(request);
  requireFields(body, ['value']);
  const value = assertNonNegativeNumber(body.value, 'value');

  const existing = await env.DB.prepare('SELECT * FROM credit_cards WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);

  await env.DB.prepare(
    `UPDATE credit_cards SET previous_value = ?, value = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).bind(existing.value, value, id).run();

  const updated = await env.DB.prepare('SELECT * FROM credit_cards WHERE id = ?').bind(id).first();
  return jsonResponse(updated);
}

export async function deleteCreditCard(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM credit_cards WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Registro não encontrado.', 404);
  await env.DB.prepare('DELETE FROM credit_cards WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}
