import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Configurar migrations e seed do Prisma
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: {
    ...(process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : {}),
    ...(process.env.SHADOW_DATABASE_URL ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL } : {}),
  },
});
