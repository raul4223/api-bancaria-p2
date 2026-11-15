import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  ACCESS_TOKEN_TTL: z
    .string()
    .regex(/^\d+[mh]$/)
    .default('60m'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ADMIN_NAME: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  SERVICE_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  CUSTOMER_MAX_PASSWORD_ATTEMPTS: z.coerce.number().int().positive().default(5),
  CUSTOMER_PASSWORD_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  BANK_TIMEZONE: z.string().default('America/Sao_Paulo'),
  TED_FEE_CENTS: z.coerce.bigint().nonnegative().default(500n),
  TED_BUSINESS_HOURS_ENABLED: z.stringbool().default(true),
  TED_START_TIME: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('06:30'),
  TED_END_TIME: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('17:00'),
  PIX_NIGHT_START: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('20:00'),
  PIX_NIGHT_END: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('06:00'),
  PIX_NIGHT_LIMIT_CENTS: z.coerce.bigint().positive().default(100_000n),
  PIX_KEYS_PER_ACCOUNT: z.coerce.number().int().positive().default(5),
  MAX_OPERATION_CENTS: z.coerce.bigint().positive().default(100_000_000n),
  DAILY_TRANSFER_LIMIT_CENTS: z.coerce.bigint().positive().default(500_000n),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Configuração de ambiente inválida: ${details.join('; ')}`);
}

// Separar os dados de conexão de uma URL MySQL completa
function readDatabaseUrl(value: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

const databaseConnection = readDatabaseUrl(
  parsed.data.NODE_ENV === 'test' ? parsed.data.TEST_DATABASE_URL : parsed.data.DATABASE_URL,
);

export const env = {
  databaseUrl:
    parsed.data.NODE_ENV === 'test' ? parsed.data.TEST_DATABASE_URL : parsed.data.DATABASE_URL,
  databaseHost: databaseConnection.host,
  databasePort: databaseConnection.port,
  databaseUser: databaseConnection.user,
  databasePassword: databaseConnection.password,
  databaseName: databaseConnection.database,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtIssuer: parsed.data.JWT_ISSUER,
  jwtAudience: parsed.data.JWT_AUDIENCE,
  accessTokenTtl: parsed.data.ACCESS_TOKEN_TTL,
  port: parsed.data.PORT,
  corsOrigin: parsed.data.CORS_ORIGIN,
  nodeEnv: parsed.data.NODE_ENV,
  adminName: parsed.data.ADMIN_NAME,
  adminEmail: parsed.data.ADMIN_EMAIL,
  adminPassword: parsed.data.ADMIN_PASSWORD,
  serviceSessionTtlMinutes: parsed.data.SERVICE_SESSION_TTL_MINUTES,
  customerMaxPasswordAttempts: parsed.data.CUSTOMER_MAX_PASSWORD_ATTEMPTS,
  customerPasswordLockMinutes: parsed.data.CUSTOMER_PASSWORD_LOCK_MINUTES,
  bankTimezone: parsed.data.BANK_TIMEZONE,
  tedFeeCents: parsed.data.TED_FEE_CENTS,
  tedBusinessHoursEnabled: parsed.data.TED_BUSINESS_HOURS_ENABLED,
  tedStartTime: parsed.data.TED_START_TIME,
  tedEndTime: parsed.data.TED_END_TIME,
  pixNightStart: parsed.data.PIX_NIGHT_START,
  pixNightEnd: parsed.data.PIX_NIGHT_END,
  pixNightLimitCents: parsed.data.PIX_NIGHT_LIMIT_CENTS,
  pixKeysPerAccount: parsed.data.PIX_KEYS_PER_ACCOUNT,
  maxOperationCents: parsed.data.MAX_OPERATION_CENTS,
  dailyTransferLimitCents: parsed.data.DAILY_TRANSFER_LIMIT_CENTS,
};
