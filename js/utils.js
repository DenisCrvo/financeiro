// Utilitários genéricos: formatação monetária, datas e máscaras de input.

export const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function getCurrentYear() {
  return new Date().getFullYear();
}

export function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

export function formatCurrencyBRL(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseCurrencyInput(str) {
  if (typeof str === 'number') return str;
  const digitsOnly = String(str).replace(/[^\d]/g, '');
  if (!digitsOnly) return 0;
  return Number(digitsOnly) / 100;
}

/** Aplica máscara monetária em tempo real (R$ 0,00) a um <input>. */
export function attachCurrencyMask(input) {
  input.addEventListener('input', () => {
    const value = parseCurrencyInput(input.value);
    input.value = formatCurrencyBRL(value).replace('R$', '').trim();
  });
  if (input.value) {
    input.value = formatCurrencyBRL(parseCurrencyInput(input.value)).replace('R$', '').trim();
  }
}

export function getCurrencyInputValue(input) {
  return parseCurrencyInput(input.value);
}

/** Formata uma data ISO (YYYY-MM-DD) para DD/MM/AAAA sem deslocamento de fuso horário. */
export function formatDateOnlyBR(isoDateStr) {
  if (!isoDateStr) return '—';
  const [year, month, day] = isoDateStr.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function formatDateTimeBR(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const dateStr = date.toLocaleDateString('pt-BR');
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { dateStr, timeStr, full: `${dateStr} ${timeStr}` };
}

export function monthName(month) {
  return MONTH_NAMES_PT[month - 1] ?? String(month);
}

export function populateYearSelect(select, { rangeBack = 3, rangeForward = 2 } = {}) {
  const currentYear = getCurrentYear();
  select.innerHTML = '';
  for (let y = currentYear - rangeBack; y <= currentYear + rangeForward; y++) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    if (y === currentYear) opt.selected = true;
    select.appendChild(opt);
  }
}

export function populateMonthSelect(select, { includeCurrent = true } = {}) {
  select.innerHTML = '';
  MONTH_NAMES_PT.forEach((name, index) => {
    const opt = document.createElement('option');
    opt.value = String(index + 1);
    opt.textContent = name;
    select.appendChild(opt);
  });
  if (includeCurrent) select.value = String(getCurrentMonth());
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
