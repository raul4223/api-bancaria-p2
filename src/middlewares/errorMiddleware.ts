import type { ErrorRequestHandler } from 'express';
import { Prisma } from '../generated/prisma/client.ts';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';

// Converter erros conhecidos em respostas seguras e uniformes
export const errorMiddleware: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Os dados enviados são inválidos.',
        details: error.issues,
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === 'P2002' ? 409 : error.code === 'P2025' ? 404 : 500;
    const code =
      error.code === 'P2002'
        ? 'DUPLICATE_RESOURCE'
        : error.code === 'P2025'
          ? 'NOT_FOUND'
          : 'DATABASE_ERROR';
    res.status(status).json({
      error: {
        code,
        message: status === 500 ? 'Erro interno do servidor.' : 'Registro inválido ou inexistente.',
      },
    });
    return;
  }

  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } });
};
