import { appErrors } from '../../errors/appErrors.js';
import { isNightTime } from '../../utils/bankTime.js';
import { systemClock, type Clock } from '../../utils/clock.js';
import type { TransferContext, TransferRule, TransferRuleConfig } from './TransferRule.js';

// Aplicar o limite noturno de transferências Pix
export class PixTransferRule implements TransferRule {
  // Receber configurações bancárias e um relógio substituível
  constructor(
    private readonly config: TransferRuleConfig,
    private readonly clock: Clock = systemClock,
  ) {}

  // Recusar valores acima do limite durante o período noturno
  validate(context: TransferContext): void {
    const date = this.clock.now();
    const isNight = isNightTime(
      date,
      this.config.bankTimezone,
      this.config.pixNightStart,
      this.config.pixNightEnd,
    );
    if (isNight && context.amountCents > this.config.pixNightLimitCents)
      throw appErrors.pixNightLimit();
  }

  // Não cobrar tarifa em transferências Pix
  calculateFee(_amountCents: bigint): bigint {
    return 0n;
  }
}
