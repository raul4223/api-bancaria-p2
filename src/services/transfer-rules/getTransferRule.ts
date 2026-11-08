import type { TransferType } from '../../generated/prisma/enums.ts';
import type { Clock } from '../../utils/clock.js';
import { env } from '../../config/env.js';
import { InternalTransferRule } from './InternalTransferRule.js';
import { PixTransferRule } from './PixTransferRule.js';
import { TedTransferRule } from './TedTransferRule.js';
import type { TransferRule, TransferRuleConfig } from './TransferRule.js';

// Ler a configuração das regras no momento da transferência
function buildRuleConfig(): TransferRuleConfig {
  return {
    bankTimezone: env.bankTimezone,
    tedFeeCents: env.tedFeeCents,
    tedBusinessHoursEnabled: env.tedBusinessHoursEnabled,
    tedStartTime: env.tedStartTime,
    tedEndTime: env.tedEndTime,
    pixNightStart: env.pixNightStart,
    pixNightEnd: env.pixNightEnd,
    pixNightLimitCents: env.pixNightLimitCents,
  };
}

// Escolher a regra correspondente ao tipo de transferência
export function getTransferRule(transferType: TransferType, clock?: Clock): TransferRule {
  const ruleConfig = buildRuleConfig();
  if (transferType === 'INTERNAL') return new InternalTransferRule(ruleConfig);
  if (transferType === 'PIX') return new PixTransferRule(ruleConfig, clock);
  return new TedTransferRule(ruleConfig, clock);
}
