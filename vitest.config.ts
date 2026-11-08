import { defineConfig } from 'vitest/config';

// Configurar a execução dos testes por ambiente
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
  },
});
