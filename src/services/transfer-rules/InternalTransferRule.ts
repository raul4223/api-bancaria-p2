import { appErrors } from '../../errors/appErrors.js';
import type { TransferContext, TransferRule, TransferRuleConfig } from './TransferRule.js';

// Aplicar as regras de transferência entre contas do mesmo cliente
export class InternalTransferRule implements TransferRule {
  // Receber as configurações compartilhadas de transferência
  constructor(_config: TransferRuleConfig) {}

  // Exigir que as duas contas pertençam ao mesmo cliente
  validate(context: TransferContext): void {
    if (!context.destinationCustomerId || context.sourceCustomerId !== context.destinationCustomerId) {
      throw appErrors.sameOwnerRequired();
    }
  }

  // Não cobrar tarifa em transferências internas
  calculateFee(_amountCents: bigint): bigint {
    return 0n;
  }
}
