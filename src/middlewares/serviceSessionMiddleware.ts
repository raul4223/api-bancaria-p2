import type { RequestHandler } from 'express';
import { z } from 'zod';
import { appErrors } from '../errors/appErrors.js';
import type { ServiceSessionService } from '../services/ServiceSessionService.js';

const serviceSessionIdSchema = z.string().uuid();

// Exigir atendimento válido pertencente ao operador autenticado
export function serviceSessionMiddleware(
  serviceSessionService: ServiceSessionService,
): RequestHandler {
  return async (req, _res, next) => {
    const headerValue = req.get('X-Service-Session-Id');
    const parsed = serviceSessionIdSchema.safeParse(headerValue);
    if (!parsed.success) return next(appErrors.sessionRequired());
    try {
      req.serviceSession = await serviceSessionService.validate(
        parsed.data,
        req.auth!.operatorUserId,
      );
      next();
    } catch (error) {
      next(error);
    }
  };
}
