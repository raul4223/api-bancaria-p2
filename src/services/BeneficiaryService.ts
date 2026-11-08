import { appErrors } from '../errors/appErrors.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { BeneficiaryRepository } from '../repositories/BeneficiaryRepository.js';
import { PixKeyRepository } from '../repositories/PixKeyRepository.js';
import { normalizePixKey } from '../utils/pixKey.js';
import type { TransferType } from '../generated/prisma/enums.ts';

type BeneficiaryInput =
  | { nickname: string; transferType: 'PIX'; pixKey: string }
  | {
      nickname: string;
      transferType: 'TED';
      destinationAgency: string;
      destinationAccountNumber: string;
    };

// Service que mantém a agenda de favorecidos isolada por cliente
export class BeneficiaryService {
  // Receber repositories de favorecidos, contas e chaves Pix
  constructor(
    private readonly beneficiaryRepository: BeneficiaryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly pixKeyRepository: PixKeyRepository,
  ) {}

  // Validar destino antes de salvar ou atualizar um favorecido
  private async validateDestination(input: BeneficiaryInput, customerId: string): Promise<void> {
    if (input.transferType === 'PIX') {
      const pixKey = await this.pixKeyRepository.findByValue(normalizePixKey(input.pixKey));
      if (
        !pixKey ||
        !pixKey.account.customerId ||
        pixKey.account.customerId === customerId ||
        pixKey.account.type === 'SYSTEM' ||
        pixKey.account.status !== 'ACTIVE'
      ) {
        throw appErrors.ownBeneficiary();
      }
      return;
    }
    const account = await this.accountRepository.findByNumber(
      input.destinationAgency,
      input.destinationAccountNumber,
    );
    if (
      !account ||
      !account.customerId ||
      account.customerId === customerId ||
      account.type === 'SYSTEM' ||
      account.status !== 'ACTIVE'
    ) {
      throw appErrors.ownBeneficiary();
    }
  }

  // Criar favorecido depois de confirmar que o destino existe
  async create(input: BeneficiaryInput, customerId: string) {
    await this.validateDestination(input, customerId);
    return this.beneficiaryRepository.create({
      customerId,
      nickname: input.nickname,
      transferType: input.transferType as TransferType,
      pixKey: input.transferType === 'PIX' ? normalizePixKey(input.pixKey) : null,
      destinationAgency: input.transferType === 'TED' ? input.destinationAgency : null,
      destinationAccountNumber:
        input.transferType === 'TED' ? input.destinationAccountNumber : null,
    });
  }

  // Listar favorecidos paginados do cliente em atendimento
  async list(input: { page: number; pageSize: number }, customerId: string) {
    const [data, total] = await Promise.all([
      this.beneficiaryRepository.findMany(
        customerId,
        (input.page - 1) * input.pageSize,
        input.pageSize,
      ),
      this.beneficiaryRepository.count(customerId),
    ]);
    return { data, page: input.page, pageSize: input.pageSize, total };
  }

  // Buscar favorecido somente na agenda do cliente atendido
  async getById(id: string, customerId: string) {
    const beneficiary = await this.beneficiaryRepository.findById(id, customerId);
    if (!beneficiary) throw appErrors.notFound('Favorecido');
    return beneficiary;
  }

  // Atualizar apelido ou destino e validar os dados combinados
  async update(
    id: string,
    input: {
      nickname?: string | undefined;
      transferType?: 'PIX' | 'TED' | undefined;
      pixKey?: string | null | undefined;
      destinationAgency?: string | null | undefined;
      destinationAccountNumber?: string | null | undefined;
    },
    customerId: string,
  ) {
    const current = await this.getById(id, customerId);
    const transferType = input.transferType ?? (current.transferType as 'PIX' | 'TED');
    let destination: BeneficiaryInput;
    if (transferType === 'PIX') {
      const pixKey = input.pixKey ?? current.pixKey;
      if (!pixKey) throw appErrors.validation();
      destination = { nickname: input.nickname ?? current.nickname, transferType, pixKey };
    } else {
      const destinationAgency = input.destinationAgency ?? current.destinationAgency;
      const destinationAccountNumber =
        input.destinationAccountNumber ?? current.destinationAccountNumber;
      if (!destinationAgency || !destinationAccountNumber) throw appErrors.validation();
      destination = {
        nickname: input.nickname ?? current.nickname,
        transferType,
        destinationAgency,
        destinationAccountNumber,
      };
    }
    await this.validateDestination(destination, customerId);
    await this.beneficiaryRepository.update(id, customerId, {
      nickname: destination.nickname,
      transferType,
      pixKey: destination.transferType === 'PIX' ? normalizePixKey(destination.pixKey) : null,
      destinationAgency: destination.transferType === 'TED' ? destination.destinationAgency : null,
      destinationAccountNumber:
        destination.transferType === 'TED' ? destination.destinationAccountNumber : null,
    });
    return this.getById(id, customerId);
  }

  // Excluir favorecido sem alterar transferências já feitas
  async delete(id: string, customerId: string): Promise<void> {
    const result = await this.beneficiaryRepository.delete(id, customerId);
    if (result.count === 0) throw appErrors.notFound('Favorecido');
  }
}
