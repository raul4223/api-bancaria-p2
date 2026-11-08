import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type RequestSchemas = { body?: ZodType; params?: ZodType; query?: ZodType; headers?: ZodType };

// Validar partes da requisição e devolver os valores transformados
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
      if (schemas.headers) req.validatedHeaders = schemas.headers.parse(req.headers);
      next();
    } catch (error) {
      next(error);
    }
  };
}
