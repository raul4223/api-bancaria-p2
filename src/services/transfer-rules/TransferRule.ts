import type { TransferType } from '../../generated/prisma/enums.ts';

export type TransferContext = {
  transferType: TransferType;
  amountCents: bigint;
  sourceCustomerId: string;
  destinationCustomerId: string | null;
  destinationAccountId: string;
  sourceAccountId: string;
};

export type TransferRuleConfig = {
  bankTimezone: string;
  tedFeeCents: bigint;
  tedBusinessHoursEnabled: boolean;
  tedStartTime: string;
  tedEndTime: string;
  pixNightStart: string;
  pixNightEnd: string;
  pixNightLimitCents: bigint;
};

// Contrato comum das regras de cada tipo de transferência
export interface TransferRule {
  // Validar as regras específicas do tipo de transferência
  validate(context: TransferContext): void;
  // Calcular a tarifa cobrada por este tipo de transferência
  calculateFee(amountCents: bigint): bigint;
}
