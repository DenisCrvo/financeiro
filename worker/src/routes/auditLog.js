// Rotas: /api/audit-log
// Histórico de todos os lançamentos (INSERT/UPDATE/DELETE) registrados
// automaticamente pelos triggers do banco em worker/migrations/0001_init.sql.

import { jsonResponse, assertYear, assertMonth, HttpError } from '../utils.js';

const VALID_TABLES = ['credit_cards', 'employee_monthly', 'employee_advances', 'fixed_expenses'];
const VALID_OPERATIONS = ['INSERT', 'UPDATE', 'DELETE'];
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

// Os filtros de ano/mês usam a data em que a alteração foi registrada
// (changed_at), não necessariamente o ano/mês do lançamento em si — os
// snapshots de UPDATE guardam apenas os campos alterados, nem sempre
// incluindo year/month do registro original.
export async function listAuditLog(request, env, url) {
  const table = url.searchParams.get('table');
  const operation = url.searchParams.get('operation');
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');
  const limitParam = url.searchParams.get('limit');

  if (table && !VALID_TABLES.includes(table)) {
    throw new HttpError(`"table" deve ser um dos valores: ${VALID_TABLES.join(', ')}`, 422);
  }
  if (operation && !VALID_OPERATIONS.includes(operation)) {
    throw new HttpError(`"operation" deve ser um dos valores: ${VALID_OPERATIONS.join(', ')}`, 422);
  }

  let limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  const conditions = [];
  const params = [];
  if (table) { conditions.push('table_name = ?'); params.push(table); }
  if (operation) { conditions.push('operation = ?'); params.push(operation); }
  if (year) { conditions.push("strftime('%Y', changed_at) = ?"); params.push(String(assertYear(year))); }
  if (month) {
    const monthNum = assertMonth(month);
    conditions.push("strftime('%m', changed_at) = ?");
    params.push(String(monthNum).padStart(2, '0'));
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT * FROM audit_log ${whereClause} ORDER BY changed_at DESC LIMIT ?`;
  params.push(limit);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse(results);
}
