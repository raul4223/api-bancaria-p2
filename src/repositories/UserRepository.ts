import { prisma } from '../database/prisma.js';

// Repository que consulta credenciais de operadores
export class UserRepository {
  // Buscar operador ativo pelo e-mail de login
  findActiveByEmail(email: string) {
    return prisma.user.findFirst({ where: { email: email.toLowerCase(), isActive: true } });
  }

  // Buscar operador ativo pelo ID gravado no token
  findActiveById(id: string) {
    return prisma.user.findFirst({ where: { id, isActive: true }, select: { id: true } });
  }
}
