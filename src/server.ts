import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';

// Iniciar o servidor HTTP e encerrar o pool Prisma ao receber sinal do sistema
const server = app.listen(env.port, () => {
  console.info(`API bancária disponível em http://localhost:${env.port}`);
});

// Encerrar o servidor sem interromper requisições ativas
async function shutdown(): Promise<void> {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
