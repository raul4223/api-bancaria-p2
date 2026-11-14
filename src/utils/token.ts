import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.jwtSecret);

// Emitir um token de acesso com a duração configurada para o operador
export function createAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(env.jwtIssuer)
    .setAudience(env.jwtAudience)
    .setIssuedAt()
    .setExpirationTime(env.accessTokenTtl)
    .sign(secret);
}

// Verificar assinatura, algoritmo, emissor, audiência e validade do token
export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
