import type { ErrorRequestHandler } from 'express';
import { Prisma } from '../generated/prisma/client.ts';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';

// Identificar erros produzidos pelo leitor de JSON do Express
function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return typeof error === 'object' && error !== null && 'type' in error && 'status' in error;
}

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
    if (status === 500) console.error('[erro-interno]', error.stack);
    res.status(status).json({
      error: {
        code,
        message: status === 500 ? 'Erro interno do servidor.' : 'Registro inválido ou inexistente.',
      },
    });
    return;
  }

  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido.' },
      });
      return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'O corpo da requisição excede o limite.' },
      });
      return;
    }
  }

  console.error('[erro-interno]', error instanceof Error ? error.stack : error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } });
};
