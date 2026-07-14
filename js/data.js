/**
 * Módulo de dados: converte o CSV bruto em estruturas prontas para a UI.
 * Único ponto de verdade sobre o "shape" dos dados financeiros em memória.
 */
import { CONFIG } from "./config.js";
import { fetchCsv } from "./api.js";
import { normalizeKey, parseCurrencyBR, monthIndex } from "./utils.js";

/** Cache em memória do dataset processado. Carregado uma única vez na inicialização. */
let cachedDataset = null;

/**
 * Faz o parse de um texto CSV em uma matriz de campos (linhas x colunas),
 * respeitando aspas RFC4180 (campos com vírgulas ou quebras de linha).
 * Implementação em JavaScript puro, sem bibliotecas externas.
 * @param {string} csvText
 * @returns {string[][]}
 */
export function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // ignora; o \n subsequente fecha a linha
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Última linha (sem quebra final)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * Transforma a matriz de linhas do CSV em um dataset estruturado.
 * A primeira linha é tratada como cabeçalho, tornando o número de colunas
 * financeiras flexível (não assume índices fixos).
 * @param {string[][]} rows
 * @returns {{financialColumns: string[], entries: object[]}}
 */
export function buildDataset(rows) {
  if (!rows || rows.length < 2) {
    return { financialColumns: [], entries: [] };
  }

  const header = rows[0].map((h) => h.trim());
  const identifierKeys = new Set(
    CONFIG.IDENTIFIER_COLUMNS.map((k) => normalizeKey(k))
  );
  const financialColumns = header.filter(
    (h) => !identifierKeys.has(normalizeKey(h))
  );

  const entries = rows.slice(1).map((cells) => {
    const record = {};
    header.forEach((columnName, index) => {
      record[columnName] = cells[index] ?? "";
    });

    const ano = parseInt(record["ANO"], 10);
    const mes = record["MÊS"] ?? record["MES"] ?? "";
    const mesIdx = monthIndex(mes);

    const valores = {};
    let total = 0;
    financialColumns.forEach((column) => {
      const valor = parseCurrencyBR(record[column]);
      valores[normalizeKey(column)] = valor;
      total += valor;
    });

    return {
      ano,
      mes: mes.trim(),
      mesIndex: mesIdx,
      valores,
      total,
    };
  });

  const validEntries = entries.filter(
    (e) => Number.isFinite(e.ano) && e.mesIndex >= 0
  );

  return { financialColumns, entries: validEntries };
}

/**
 * Carrega os dados da planilha, faz o parse e mantém em cache em memória.
 * Chamadas subsequentes reutilizam o cache, a menos que forceRefresh seja true.
 * @param {boolean} forceRefresh força nova busca ignorando o cache.
 * @returns {Promise<{financialColumns: string[], entries: object[]}>}
 */
export async function loadDataset(forceRefresh = false) {
  if (cachedDataset && !forceRefresh) {
    return cachedDataset;
  }

  const csvText = await fetchCsv();
  const rows = parseCsv(csvText);
  const dataset = buildDataset(rows);

  if (dataset.entries.length === 0) {
    throw new Error(
      "A planilha foi carregada, mas nenhum registro válido foi encontrado."
    );
  }

  cachedDataset = dataset;
  return cachedDataset;
}

/** Retorna a lista de anos distintos presentes no dataset, em ordem crescente. */
export function getAvailableYears(dataset) {
  const years = new Set(dataset.entries.map((e) => e.ano));
  return Array.from(years).sort((a, b) => a - b);
}

/** Filtra e ordena (por mês) as entradas de um determinado ano. */
export function filterByYear(dataset, year) {
  return dataset.entries
    .filter((e) => e.ano === Number(year))
    .sort((a, b) => a.mesIndex - b.mesIndex);
}

/**
 * Localiza o registro do "próximo mês" a partir da data atual do sistema.
 * Se o mês seguinte exato não existir na planilha, retorna o próximo
 * registro cronologicamente disponível.
 * @param {object} dataset
 * @param {Date} referenceDate data de referência (padrão: agora).
 * @returns {object|null}
 */
export function getNextMonthEntry(dataset, referenceDate = new Date()) {
  const sorted = [...dataset.entries].sort(
    (a, b) => a.ano - b.ano || a.mesIndex - b.mesIndex
  );

  const currentYear = referenceDate.getFullYear();
  const currentMonthIndex = referenceDate.getMonth();

  let targetYear = currentYear;
  let targetMonthIndex = currentMonthIndex + 1;
  if (targetMonthIndex > 11) {
    targetMonthIndex = 0;
    targetYear += 1;
  }

  const exactMatch = sorted.find(
    (e) => e.ano === targetYear && e.mesIndex === targetMonthIndex
  );
  if (exactMatch) return exactMatch;

  const nextAvailable = sorted.find(
    (e) =>
      e.ano > targetYear ||
      (e.ano === targetYear && e.mesIndex >= targetMonthIndex)
  );

  return nextAvailable ?? sorted[sorted.length - 1] ?? null;
}
