import { Prisma } from '../generated/prisma/client.ts';
import { appErrors } from '../errors/appErrors.js';
import { CustomerRepository } from '../repositories/CustomerRepository.js';
import { hashPassword } from '../utils/password.js';
import { maskCpf } from '../utils/mask.js';
import { omitPasswordHash } from '../utils/presenters.js';

// Service com regras de cadastro, consulta e manutenção de clientes
export class CustomerService {
  // Receber o repository de clientes
  constructor(private readonly customerRepository: CustomerRepository) {}

  // Criar cliente com CPF validado e senha protegida
  async create(input: { name: string; cpf: string; email?: string | undefined; phone?: string | undefined; customerPassword: string }) {
    try {
      const customer = await this.customerRepository.create({
        name: input.name,
        cpf: input.cpf,
        ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        passwordHash: await hashPassword(input.customerPassword),
      });
      return omitPasswordHash(customer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw appErrors.duplicateCustomer();
      throw error;
    }
  }

  // Listar clientes com CPF mascarado e saldo total agregado
  async list(input: { page: number; pageSize: number; search?: string | undefined; cpf?: string | undefined }) {
    const where: Prisma.CustomerWhereInput = {};
    if (input.search) where.OR = [{ name: { contains: input.search } }, { email: { contains: input.search } }];
    if (input.cpf) where.cpf = input.cpf;
    const [customers, total] = await Promise.all([
      this.customerRepository.findMany({ where, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
      this.customerRepository.count(where),
    ]);
    return {
      data: customers.map(({ cpf, accounts, _count, ...customer }) => ({
        ...omitPasswordHash(customer),
        cpf: maskCpf(cpf),
        accountCount: _count.accounts,
        totalBalanceCents: accounts.reduce((sum, account) => sum + account.balanceCents, 0n).toString(),
      })),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  // Buscar cliente e contas para conferência do operador
  async getById(customerId: string) {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw appErrors.notFound('Cliente');
    const { accounts, ...customerData } = customer;
    const safeCustomer = omitPasswordHash(customerData);
    return { ...safeCustomer, accounts: accounts.map((account) => ({ ...account, balanceCents: account.balanceCents.toString() })) };
  }

  // Atualizar nome e dados de contato sem permitir troca de CPF ou senha
  async update(customerId: string, input: { name?: string | undefined; email?: string | null | undefined; phone?: string | null | undefined }) {
    if (!(await this.customerRepository.findById(customerId))) throw appErrors.notFound('Cliente');
    try {
      const data: Prisma.CustomerUpdateInput = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.email !== undefined) data.email = input.email?.toLowerCase() ?? null;
      if (input.phone !== undefined) data.phone = input.phone;
      const customer = await this.customerRepository.update(customerId, data);
      return omitPasswordHash(customer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw appErrors.duplicateCustomer();
      throw error;
    }
  }

  // Excluir fisicamente apenas clientes sem contas ou atendimentos
  async delete(customerId: string): Promise<void> {
    if (!(await this.customerRepository.findById(customerId))) throw appErrors.notFound('Cliente');
    if (await this.customerRepository.hasHistory(customerId)) throw appErrors.customerHasHistory();
    await this.customerRepository.delete(customerId);
  }
}
