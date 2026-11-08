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

// Definir validação e cálculo de tarifa de cada tipo de transferência
export interface TransferRule {
  validate(context: TransferContext): void;
  calculateFee(amountCents: bigint): bigint;
}
