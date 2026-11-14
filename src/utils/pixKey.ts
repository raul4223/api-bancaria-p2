// Normalizar o valor de uma chave Pix preservando o "+" de telefones
export function normalizePixKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^\+?[()\d\s.-]+$/.test(normalized)) return normalized;
  const digits = normalized.replace(/\D/g, '');
  return normalized.startsWith('+') ? `+${digits}` : digits;
}

// Validar e-mail usado como chave Pix
export function isValidPixEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Converter telefone brasileiro para o formato internacional da chave Pix
export function toPixPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  const national =
    digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
      ? digits.slice(2)
      : digits;
  return national.length === 10 || national.length === 11 ? `+55${national}` : null;
}
