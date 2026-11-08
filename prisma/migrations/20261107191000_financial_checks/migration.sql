ALTER TABLE `Account`
  ADD CONSTRAINT `Account_balance_nonnegative_except_system`
  CHECK (`balanceCents` >= 0 OR `type` = 'SYSTEM');

ALTER TABLE `BankTransaction`
  ADD CONSTRAINT `BankTransaction_amountCents_positive`
  CHECK (`amountCents` > 0),
  ADD CONSTRAINT `BankTransaction_feeCents_nonnegative`
  CHECK (`feeCents` >= 0);

ALTER TABLE `LedgerEntry`
  ADD CONSTRAINT `LedgerEntry_amountCents_positive`
  CHECK (`amountCents` > 0);

ALTER TABLE `Customer`
  ADD CONSTRAINT `Customer_failedPasswordAttempts_nonnegative`
  CHECK (`failedPasswordAttempts` >= 0);
