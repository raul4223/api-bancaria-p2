// Mascarar o CPF mantendo os dígitos finais para conferência visual
export function maskCpf(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

// Mascarar os dígitos centrais do número de conta
export function maskAccountNumber(number: string): string {
  return `${number.slice(0, 2)}****${number.slice(-2)}`;
}

// Mascarar parcialmente o nome do titular
export function maskName(name: string): string {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return rest.length === 0 ? `${first.slice(0, 1)}***` : `${first} ${rest[0]!.slice(0, 1)}***`;
}
