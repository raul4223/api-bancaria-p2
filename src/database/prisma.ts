import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.ts';
import { env } from '../config/env.js';

const adapter = new PrismaMariaDb({
  host: env.databaseHost,
  port: env.databasePort,
  user: env.databaseUser,
  password: env.databasePassword,
  database: env.databaseName,
  connectionLimit: 10,
});

// Criar a instância única de acesso ao banco
export const prisma = new PrismaClient({ adapter });
