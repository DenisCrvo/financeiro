// Utilitários compartilhados pelo Worker: respostas HTTP, validação e helpers.

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      ...extraHeaders,
    },
  });
}

export function errorResponse(message, status = 400, extraHeaders = {}) {
  return jsonResponse({ error: message }, status, extraHeaders);
}

export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export async function parseJsonBody(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    throw new HttpError('Corpo da requisição inválido (JSON malformado).', 400);
  }
}

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) {
    throw new HttpError(`Campos obrigatórios ausentes: ${missing.join(', ')}`, 422);
  }
}

export function assertNonNegativeNumber(value, fieldName) {
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    throw new HttpError(`O campo "${fieldName}" deve ser um número maior ou igual a zero.`, 422);
  }
  return num;
}

export function assertMonth(value) {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new HttpError('O campo "month" deve ser um inteiro entre 1 e 12.', 422);
  }
  return month;
}

export function assertYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpError('O campo "year" deve ser um ano válido (2000-2100).', 422);
  }
  return year;
}

export function nowIso() {
  return new Date().toISOString();
}

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function monthName(month) {
  return MONTH_NAMES_PT[month - 1] ?? String(month);
}
