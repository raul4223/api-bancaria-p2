import type { Prisma } from '../generated/prisma/client.ts';
import { appErrors } from '../errors/appErrors.js';
import { ServiceSessionRepository } from '../repositories/ServiceSessionRepository.js';
import { CustomerRepository } from '../repositories/CustomerRepository.js';
import { verifyPassword } from '../utils/password.js';
import { systemClock, type Clock } from '../utils/clock.js';
import { maskCpf } from '../utils/mask.js';
import { env } from '../config/env.js';
import { omitPasswordHash } from '../utils/presenters.js';

type SessionWithCustomer = Prisma.ServiceSessionGetPayload<{ include: { customer: true } }>;

// Service que abre, valida e encerra atendimentos autorizados pelo cliente
export class ServiceSessionService {
  // Receber repositories e configuração temporal
  constructor(
    private readonly sessionRepository: ServiceSessionRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  // Abrir atendimento depois de validar a senha do cliente
  async open(input: { cpf: string; customerPassword: string }, operatorUserId: string) {
    const customer = await this.customerRepository.findByCpf(input.cpf);
    if (!customer) throw appErrors.customerCredentials();
    const now = this.clock.now();
    if (customer.passwordLockedUntil && customer.passwordLockedUntil > now)
      throw appErrors.customerLocked();

    if (!(await verifyPassword(customer.passwordHash, input.customerPassword))) {
      const attempts = await this.sessionRepository.incrementFailedAttempts(
        customer.id,
        now,
        env.customerMaxPasswordAttempts,
        env.customerPasswordLockMinutes,
      );
      if (attempts >= env.customerMaxPasswordAttempts) throw appErrors.customerLocked();
      throw appErrors.customerCredentials();
    }

    await this.sessionRepository.resetFailedAttempts(customer.id);
    await this.sessionRepository.closeOpenForOperator(operatorUserId, now);
    const session = await this.sessionRepository.create({
      operatorUserId,
      customerId: customer.id,
      status: 'OPEN',
      openedAt: now,
      expiresAt: new Date(now.getTime() + env.serviceSessionTtlMinutes * 60_000),
    });
    return this.presentSession(session);
  }

  // Buscar o atendimento aberto e ainda válido do operador autenticado
  async getCurrent(operatorUserId: string) {
    const session = await this.sessionRepository.findOpenForOperator(operatorUserId);
    if (!session) throw appErrors.notFound('Atendimento');
    if (session.expiresAt <= this.clock.now()) {
      await this.sessionRepository.expire(session.id);
      throw appErrors.notFound('Atendimento');
    }
    return this.presentSession(session);
  }

  // Fechar atendimento aberto que pertence ao operador autenticado
  async close(serviceSessionId: string, operatorUserId: string) {
    const session = await this.sessionRepository.findByIdForOperator(
      serviceSessionId,
      operatorUserId,
    );
    if (!session) throw appErrors.notFound('Atendimento');
    if (session.status !== 'OPEN') throw appErrors.sessionInvalid();
    await this.sessionRepository.close(serviceSessionId, operatorUserId, this.clock.now());
    return { id: serviceSessionId, status: 'CLOSED' as const };
  }

  // Validar se o atendimento continua aberto, dentro do prazo e do operador
  async validate(serviceSessionId: string, operatorUserId: string) {
    const session = await this.sessionRepository.findByIdForOperator(
      serviceSessionId,
      operatorUserId,
    );
    if (!session) throw appErrors.sessionInvalid();
    if (session.status !== 'OPEN') throw appErrors.sessionInvalid();
    if (session.expiresAt <= this.clock.now()) {
      await this.sessionRepository.expire(session.id);
      throw appErrors.sessionInvalid();
    }
    return { serviceSessionId: session.id, customerId: session.customerId, operatorUserId };
  }

  // Montar a resposta do atendimento com CPF mascarado e sem hash de senha
  private presentSession(session: SessionWithCustomer) {
    const { cpf, ...customerData } = session.customer;
    return { ...session, customer: { ...omitPasswordHash(customerData), cpf: maskCpf(cpf) } };
  }
}
