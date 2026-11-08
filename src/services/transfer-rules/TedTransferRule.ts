import { appErrors } from '../../errors/appErrors.js';
import { isWithinBusinessHours } from '../../utils/bankTime.js';
import { systemClock, type Clock } from '../../utils/clock.js';
import type { TransferContext, TransferRule, TransferRuleConfig } from './TransferRule.js';

// Aplicar horário comercial e tarifa de transferências TED simuladas
export class TedTransferRule implements TransferRule {
  // Receber configurações bancárias e um relógio substituível
  constructor(
    private readonly config: TransferRuleConfig,
    private readonly clock: Clock = systemClock,
  ) {}

  // Recusar TED fora do horário configurado em dias úteis
  validate(_context: TransferContext): void {
    if (!this.config.tedBusinessHoursEnabled) return;
    const date = this.clock.now();
    const isOpen = isWithinBusinessHours(
      date,
      this.config.bankTimezone,
      this.config.tedStartTime,
      this.config.tedEndTime,
    );
    if (!isOpen) throw appErrors.tedOutsideHours();
  }

  // Devolver a tarifa fixa configurada para TED
  calculateFee(_amountCents: bigint): bigint {
    return this.config.tedFeeCents;
  }
}
