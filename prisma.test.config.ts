import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Configurar deploy das migrations exclusivamente no banco E2E
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: process.env.TEST_DATABASE_URL ? { url: process.env.TEST_DATABASE_URL } : {},
});
