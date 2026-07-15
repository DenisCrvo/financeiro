// Regras de negócio do módulo de cadastro de despesas.
// Mantém a lógica de cálculo e validação isolada da interface (app.js).

export function calculateTransportValue(daysWorked, dailyTransportValue) {
  const days = Number(daysWorked) || 0;
  const daily = Number(dailyTransportValue) || 0;
  return Number((days * daily).toFixed(2));
}

export function validatePositiveNumber(value, fieldLabel) {
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    return `O campo "${fieldLabel}" deve ser um valor numérico maior ou igual a zero.`;
  }
  return null;
}

export function validateRequired(value, fieldLabel) {
  if (value === undefined || value === null || value === '') {
    return `O campo "${fieldLabel}" é obrigatório.`;
  }
  return null;
}

export function validateCreditCardForm({ year, month, value }) {
  const errors = [];
  if (validateRequired(year, 'Ano')) errors.push(validateRequired(year, 'Ano'));
  if (validateRequired(month, 'Mês')) errors.push(validateRequired(month, 'Mês'));
  const valueError = validatePositiveNumber(value, 'Valor da fatura');
  if (valueError) errors.push(valueError);
  return errors;
}

export function validateEmployeeForm({ year, month, days_worked, daily_transport_value }) {
  const errors = [];
  if (validateRequired(year, 'Ano')) errors.push(validateRequired(year, 'Ano'));
  if (validateRequired(month, 'Mês')) errors.push(validateRequired(month, 'Mês'));
  const daysError = validatePositiveNumber(days_worked, 'Dias trabalhados');
  if (daysError) errors.push(daysError);
  const dailyError = validatePositiveNumber(daily_transport_value, 'Valor diário do transporte');
  if (dailyError) errors.push(dailyError);
  return errors;
}

export function validateFixedExpenseForm({ expense_type_id, year, months, value }) {
  const errors = [];
  if (validateRequired(expense_type_id, 'Tipo de despesa')) errors.push(validateRequired(expense_type_id, 'Tipo de despesa'));
  if (validateRequired(year, 'Ano')) errors.push(validateRequired(year, 'Ano'));
  if (!months || months.length === 0) errors.push('Selecione ao menos um mês.');
  const valueError = validatePositiveNumber(value, 'Valor');
  if (valueError) errors.push(valueError);
  return errors;
}

// Adiantamento: mesmo formato de lançamento em lote das Despesas Fixas
// (ano + meses). Uso exclusivo para controle de desconto em folha/e-social —
// não é contabilizado nos totais do sistema.
export function validateAdvanceForm({ value, year, months }) {
  const errors = [];
  const valueError = validatePositiveNumber(value, 'Valor do desconto');
  if (valueError) errors.push(valueError);
  if (validateRequired(year, 'Ano')) errors.push(validateRequired(year, 'Ano'));
  if (!months || months.length === 0) errors.push('Selecione ao menos um mês.');
  return errors;
}
