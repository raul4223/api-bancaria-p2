import { Prisma } from '../generated/prisma/client.ts';
import { prisma } from '../database/prisma.js';
import { appErrors } from '../errors/appErrors.js';
import { CustomerRepository } from '../repositories/CustomerRepository.js';
import { AccountService } from './AccountService.js';
import { hashPassword } from '../utils/password.js';
import { maskCpf } from '../utils/mask.js';
import { omitPasswordHash } from '../utils/presenters.js';

// Service com regras de cadastro, consulta e manutenção de clientes
export class CustomerService {
  // Receber o repository de clientes e o service que abre contas
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly accountService: AccountService,
  ) {}

  // Cadastrar cliente e abrir sua primeira conta numa única transação
  async create(input: {
    name: string;
    cpf: string;
    email?: string | undefined;
    phone?: string | undefined;
    customerPassword: string;
    accountType: 'CHECKING' | 'SAVINGS';
  }) {
    const passwordHash = await hashPassword(input.customerPassword);
    try {
      const { customer, account } = await prisma.$transaction(async (tx) => {
        const customer = await this.customerRepository.create(
          {
            name: input.name,
            cpf: input.cpf,
            ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            passwordHash,
          },
          tx,
        );
        const account = await this.accountService.createForCustomer(
          customer.id,
          input.accountType,
          tx,
        );
        return { customer, account };
      });
      return {
        ...omitPasswordHash(customer),
        accounts: [{ ...account, balanceCents: account.balanceCents.toString() }],
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw appErrors.duplicateCustomer();
      throw error;
    }
  }

  // Listar clientes com CPF mascarado, contas (agência e número) e saldo total
  async list(input: {
    page: number;
    pageSize: number;
    search?: string | undefined;
    cpf?: string | undefined;
  }) {
    const where: Prisma.CustomerWhereInput = {};
    if (input.search)
      where.OR = [{ name: { contains: input.search } }, { email: { contains: input.search } }];
    if (input.cpf) where.cpf = input.cpf;
    const [customers, total] = await Promise.all([
      this.customerRepository.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.customerRepository.count(where),
    ]);
    return {
      data: customers.map(({ cpf, accounts, ...customer }) => ({
        ...omitPasswordHash(customer),
        cpf: maskCpf(cpf),
        accounts: accounts.map((account) => ({
          agency: account.agency,
          number: account.number,
          type: account.type,
          status: account.status,
        })),
        accountCount: accounts.length,
        totalBalanceCents: accounts
          .reduce((sum, account) => sum + account.balanceCents, 0n)
          .toString(),
      })),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  // Buscar cliente pelo CPF, que identifica o cliente no CRUD
  private async findByCpfOrFail(cpf: string) {
    const customer = await this.customerRepository.findByCpf(cpf);
    if (!customer) throw appErrors.notFound('Cliente');
    return customer;
  }

  // Buscar cliente e contas pelo CPF para conferência do operador
  async getById(cpf: string) {
    const customer = await this.findByCpfOrFail(cpf);
    const { accounts, ...customerData } = customer;
    const safeCustomer = omitPasswordHash(customerData);
    return {
      ...safeCustomer,
      accounts: accounts.map((account) => ({
        ...account,
        balanceCents: account.balanceCents.toString(),
      })),
    };
  }

  // Atualizar nome e dados de contato sem permitir troca de CPF ou senha
  async update(
    cpf: string,
    input: {
      name?: string | undefined;
      email?: string | null | undefined;
      phone?: string | null | undefined;
    },
  ) {
    const { id: customerId } = await this.findByCpfOrFail(cpf);
    try {
      const data: Prisma.CustomerUpdateInput = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.email !== undefined) data.email = input.email?.toLowerCase() ?? null;
      if (input.phone !== undefined) data.phone = input.phone;
      const customer = await this.customerRepository.update(customerId, data);
      return omitPasswordHash(customer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw appErrors.duplicateCustomer();
      throw error;
    }
  }

  // Excluir cadastro feito por engano: sem atendimentos, movimentações nem saldo
  async delete(cpf: string): Promise<void> {
    const { id: customerId } = await this.findByCpfOrFail(cpf);
    const history = await this.customerRepository.getHistorySummary(customerId);
    const hasHistory =
      history.sessionCount > 0 ||
      history.transactionCount > 0 ||
      history.ledgerEntryCount > 0 ||
      history.accountsWithBalance > 0;
    if (hasHistory) throw appErrors.customerHasHistory();
    await this.customerRepository.delete(customerId);
  }
}
