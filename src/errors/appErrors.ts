import { AppError } from './AppError.js';

// Criar os erros padronizados usados pelas regras da API
export const appErrors = {
  validation: () => new AppError(422, 'VALIDATION_ERROR', 'Os dados enviados são inválidos.'),
  unauthorized: () => new AppError(401, 'UNAUTHORIZED', 'Autenticação necessária.'),
  invalidCredentials: () => new AppError(401, 'INVALID_CREDENTIALS', 'Credenciais inválidas.'),
  customerCredentials: () =>
    new AppError(401, 'INVALID_CUSTOMER_CREDENTIALS', 'Dados do cliente inválidos.'),
  customerLocked: () =>
    new AppError(423, 'CUSTOMER_PASSWORD_LOCKED', 'Senha bloqueada temporariamente.'),
  sessionRequired: () => new AppError(401, 'SERVICE_SESSION_REQUIRED', 'Atendimento necessário.'),
  sessionInvalid: () =>
    new AppError(403, 'SERVICE_SESSION_INVALID', 'Atendimento inválido ou encerrado.'),
  notFound: (resource = 'Registro') =>
    new AppError(404, 'NOT_FOUND', `${resource} não encontrado.`),
  duplicateCustomer: () => new AppError(409, 'DUPLICATE_CUSTOMER', 'CPF ou e-mail já cadastrado.'),
  customerHasHistory: () =>
    new AppError(
      409,
      'CUSTOMER_HAS_HISTORY',
      'Cliente com atendimentos, movimentações ou saldo não pode ser excluído.',
    ),
  weakCustomerPassword: () =>
    new AppError(422, 'WEAK_CUSTOMER_PASSWORD', 'Senha de atendimento fraca.'),
  insufficientFunds: () =>
    new AppError(422, 'INSUFFICIENT_FUNDS', 'Saldo insuficiente para a operação.'),
  accountBlocked: () => new AppError(422, 'ACCOUNT_BLOCKED', 'A conta está bloqueada.'),
  invalidAmount: () =>
    new AppError(422, 'INVALID_AMOUNT', 'O valor deve ser positivo em centavos.'),
  idempotencyConflict: () =>
    new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Chave de idempotência usada com outros dados.'),
  pixKeyNotFound: () => new AppError(404, 'PIX_KEY_NOT_FOUND', 'Chave Pix não encontrada.'),
  pixKeyConflict: () => new AppError(409, 'PIX_KEY_ALREADY_EXISTS', 'Chave Pix já cadastrada.'),
  pixKeyLimit: () =>
    new AppError(422, 'PIX_KEY_LIMIT_REACHED', 'Limite de chaves por conta atingido.'),
  pixNightLimit: () =>
    new AppError(422, 'PIX_NIGHT_LIMIT_EXCEEDED', 'Valor acima do limite noturno Pix.'),
  tedOutsideHours: () =>
    new AppError(422, 'TED_OUTSIDE_BUSINESS_HOURS', 'TED fora do horário bancário.'),
  sameOwnerRequired: () =>
    new AppError(
      422,
      'INTERNAL_TRANSFER_REQUIRES_SAME_OWNER',
      'Transferência interna exige o mesmo titular.',
    ),
  sameAccount: () =>
    new AppError(422, 'SAME_ACCOUNT_TRANSFER', 'Origem e destino devem ser diferentes.'),
  destinationNotFound: () =>
    new AppError(404, 'DESTINATION_ACCOUNT_NOT_FOUND', 'Conta de destino não encontrada.'),
  ownBeneficiary: () =>
    new AppError(422, 'INVALID_BENEFICIARY_DESTINATION', 'Destino inválido para favorecido.'),
};
