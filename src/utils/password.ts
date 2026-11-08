import argon2 from 'argon2';

// Criar um hash Argon2id para uma senha
export function hashPassword(value: string): Promise<string> {
  return argon2.hash(value, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
}

// Verificar uma senha sem expor o hash
export function verifyPassword(hash: string, value: string): Promise<boolean> {
  return argon2.verify(hash, value);
}
