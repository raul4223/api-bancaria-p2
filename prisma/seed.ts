import 'dotenv/config';
import { prisma } from '../src/database/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { env } from '../src/config/env.js';

// Garantir a conta de compensação usada nas operações simuladas
async function ensureSystemAccount(): Promise<void> {
  const existing = await prisma.account.findFirst({ where: { type: 'SYSTEM' } });
  if (!existing) {
    await prisma.account.create({
      data: { agency: '0000', number: 'SYSTEM', type: 'SYSTEM', customerId: null, balanceCents: 0n },
    });
  }
}

// Criar ou atualizar o operador master quando as credenciais locais existirem
async function ensureAdmin(): Promise<void> {
  if (!env.adminName || !env.adminEmail || !env.adminPassword) {
    console.info('Operador master não criado: configure as variáveis ADMIN_* locais.');
    return;
  }
  const passwordHash = await hashPassword(env.adminPassword);
  await prisma.user.upsert({
    where: { email: env.adminEmail.toLowerCase() },
    create: { name: env.adminName, email: env.adminEmail.toLowerCase(), passwordHash },
    update: { name: env.adminName, passwordHash, isActive: true },
  });
}

// Executar o seed mínimo sem inserir dados pessoais de demonstração
async function main(): Promise<void> {
  await ensureSystemAccount();
  await ensureAdmin();
}

main().catch((error: unknown) => {
  console.error('Falha ao executar seed:', error instanceof Error ? error.message : 'erro desconhecido');
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
