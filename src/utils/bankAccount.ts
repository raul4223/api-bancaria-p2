// Agência fixa em que o banco simulado abre as contas de clientes
export const customerAgency = '0001';

// Verificar se o número de conta tem o formato gerado pelo banco (7 dígitos)
export function isValidAccountNumber(value: string): boolean {
  return /^\d{7}$/.test(value);
}
