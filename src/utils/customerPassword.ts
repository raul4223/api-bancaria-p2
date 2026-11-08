// Validar o formato numérico da senha de atendimento
export function isCustomerPassword(value: string): boolean {
  return /^\d{6}$/.test(value);
}

// Recusar senhas repetidas ou sequenciais
export function isWeakCustomerPassword(value: string): boolean {
  if (!isCustomerPassword(value)) return true;
  if (/^(\d)\1{5}$/.test(value)) return true;

  const digits = [...value].map(Number);
  const isIncreasing = digits.every((digit, index) => index === 0 || digit === digits[index - 1]! + 1);
  const isDecreasing = digits.every((digit, index) => index === 0 || digit === digits[index - 1]! - 1);
  return isIncreasing || isDecreasing;
}
