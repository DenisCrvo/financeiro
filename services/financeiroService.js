// Regras de negócio do módulo de cadastro de despesas.
// Mantém a lógica de cálculo e validação isolada da interface (app.js).

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

export function validateFixedExpenseForm({ expense_type_id, year, months, value }) {
  const errors = [];
  if (validateRequired(expense_type_id, 'Tipo de despesa')) errors.push(validateRequired(expense_type_id, 'Tipo de despesa'));
  if (validateRequired(year, 'Ano')) errors.push(validateRequired(year, 'Ano'));
  if (!months || months.length === 0) errors.push('Selecione ao menos um mês.');
  const valueError = validatePositiveNumber(value, 'Valor');
  if (valueError) errors.push(valueError);
  return errors;
}

// Vale-Transporte (Lei 7.418/1985). `valorPassagemDia` já é o custo de
// ida+volta informado pelo usuário, então o benefício do dia é só esse
// valor — o total do mês é dias úteis × valor/dia.
export function calcularValeTransporte({ diasUteis, valorPassagemDia, salario }) {
  const valorVt = Math.round((Number(diasUteis) || 0) * (Number(valorPassagemDia) || 0) * 100) / 100;
  const valorTotal = Math.round(((Number(salario) || 0) + valorVt) * 100) / 100;
  return { valorVt, valorTotal };
}

export function validateFuncionariaPaymentForm({ year, months, salario }) {
  const errors = [];
  if (validateRequired(year, 'Ano')) errors.push(validateRequired(year, 'Ano'));
  if (!months || months.length === 0) errors.push('Selecione ao menos um mês.');
  const valueError = validatePositiveNumber(salario, 'Salário');
  if (valueError) errors.push(valueError);
  return errors;
}
