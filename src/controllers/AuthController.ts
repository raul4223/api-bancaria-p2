import type { Request, Response } from 'express';
import type { AuthService } from '../services/AuthService.js';

// Controller que recebe requisições de autenticação
export class AuthController {
  // Receber o service de autenticação
  constructor(private readonly authService: AuthService) {}

  // Validar credenciais do operador e devolver o token
  login = async (req: Request, res: Response) => {
    const result = await this.authService.login(req.body as { email: string; password: string });
    res.status(200).json(result);
  };
}
