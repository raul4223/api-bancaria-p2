// Normalizar o valor de uma chave Pix para comparação
export function normalizePixKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  return /^[+()\d\s.-]+$/.test(normalized) ? normalized.replace(/\D/g, '') : normalized;
}

// Validar e-mail usado como chave Pix
export function isValidPixEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Validar telefone brasileiro usado como chave Pix
export function isValidPixPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}
