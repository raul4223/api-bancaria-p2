import { appErrors } from '../errors/appErrors.js';
import { verifyPassword } from '../utils/password.js';
import { createAccessToken } from '../utils/token.js';
import { UserRepository } from '../repositories/UserRepository.js';

// Service que autentica operadores e emite tokens de acesso
export class AuthService {
  // Receber o repository de operadores
  constructor(private readonly userRepository: UserRepository) {}

  // Conferir credenciais do operador e emitir JWT
  async login(input: { email: string; password: string }) {
    const user = await this.userRepository.findActiveByEmail(input.email);
    if (!user || !(await verifyPassword(user.passwordHash, input.password))) throw appErrors.invalidCredentials();
    return { accessToken: await createAccessToken(user.id), tokenType: 'Bearer', expiresIn: '60m', operator: { id: user.id, name: user.name, email: user.email } };
  }
}
