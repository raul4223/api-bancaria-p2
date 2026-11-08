import { TransactionRepository } from '../repositories/TransactionRepository.js';

// Service que compara saldos materializados com o ledger imutável
export class LedgerService {
  // Receber o repository de transações e lançamentos
  constructor(private readonly transactionRepository: TransactionRepository) {}

  // Conciliar partidas, contas e saldos materializados
  async getReconciliation() {
    const [groups, accounts] = await Promise.all([
      this.transactionRepository.groupLedger(),
      this.transactionRepository.findAccountBalances(),
    ]);
    const accountLedger = new Map<string, bigint>();
    let debits = 0n;
    let credits = 0n;
    for (const group of groups) {
      const amount = group._sum.amountCents ?? 0n;
      const signedAmount = group.direction === 'CREDIT' ? amount : -amount;
      accountLedger.set(group.accountId, (accountLedger.get(group.accountId) ?? 0n) + signedAmount);
      if (group.direction === 'CREDIT') credits += amount;
      else debits += amount;
    }
    const discrepancies = accounts.flatMap((account) => {
      const ledgerBalanceCents = accountLedger.get(account.id) ?? 0n;
      return ledgerBalanceCents === account.balanceCents ? [] : [{
        accountId: account.id,
        number: account.number,
        accountType: account.type,
        materializedBalanceCents: account.balanceCents.toString(),
        ledgerBalanceCents: ledgerBalanceCents.toString(),
      }];
    });
    return {
      balanced: debits === credits && discrepancies.length === 0,
      debitTotalCents: debits.toString(),
      creditTotalCents: credits.toString(),
      discrepancies,
      checkedAccounts: accounts.length,
    };
  }
}
