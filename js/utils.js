/**
 * Funções utilitárias puras, sem dependência de estado ou DOM.
 */
import { CONFIG } from "./config.js";

/**
 * Remove acentos e normaliza uma string para maiúsculas, sem espaços nas bordas.
 * Usado para comparar nomes de colunas/meses de forma resiliente a variações
 * de acentuação vindas da planilha.
 */
export function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/**
 * Converte um valor monetário no formato brasileiro (ex: " R$  1.234,56 ")
 * para um número JavaScript (1234.56). Valores vazios, "-" ou inválidos
 * retornam 0, garantindo que somas nunca quebrem por causa de células vazias.
 */
export function parseCurrencyBR(rawValue) {
  if (rawValue === null || rawValue === undefined) return 0;

  const cleaned = String(rawValue)
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/-{1,}$/, "")
    .trim();

  if (cleaned === "" || cleaned === "-") return 0;

  const numeric = cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(numeric);

  return Number.isFinite(parsed) ? parsed : 0;
}

/** Formata um número como moeda brasileira (R$ 1.234,56). */
export function formatCurrencyBR(value) {
  return new Intl.NumberFormat(CONFIG.LOCALE, {
    style: "currency",
    currency: CONFIG.CURRENCY,
  }).format(Number(value) || 0);
}

/** Formata uma data no padrão dd/MM/yyyy HH. */
export function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}`;
}

/** Retorna o índice (0-11) de um nome de mês da planilha, ou -1 se não encontrado. */
export function monthIndex(monthName) {
  return CONFIG.MONTHS.indexOf(normalizeKey(monthName));
}

/** Capitaliza a primeira letra de cada palavra (ex: "JANEIRO" -> "Janeiro"). */
export function toTitleCase(text) {
  return String(text)
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());
}
