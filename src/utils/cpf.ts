// Normalizar CPF para os onze dígitos
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

// Validar os dígitos verificadores de um CPF
export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^([0-9])\1{10}$/.test(cpf)) return false;

  // Calcular um dígito verificador do CPF com o peso inicial informado
  const calculateDigit = (digits: string, weight: number): number => {
    const sum = [...digits].reduce((total, digit, index) => total + Number(digit) * (weight - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    calculateDigit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}
