import { Router } from 'express';
import { container } from '../container.js';
import { loginRateLimit } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema } from '../schemas/auth.schemas.js';

// Registrar a rota pública de login do administrador
export const authRoutes = Router();
authRoutes.post(
  '/login',
  loginRateLimit,
  validate({ body: loginSchema }),
  container.authController.login,
);
