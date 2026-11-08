import { AccountRepository } from './repositories/AccountRepository.js';
import { BeneficiaryRepository } from './repositories/BeneficiaryRepository.js';
import { CustomerRepository } from './repositories/CustomerRepository.js';
import { PixKeyRepository } from './repositories/PixKeyRepository.js';
import { ServiceSessionRepository } from './repositories/ServiceSessionRepository.js';
import { TransactionRepository } from './repositories/TransactionRepository.js';
import { UserRepository } from './repositories/UserRepository.js';
import { AccountService } from './services/AccountService.js';
import { AuthService } from './services/AuthService.js';
import { BeneficiaryService } from './services/BeneficiaryService.js';
import { CustomerService } from './services/CustomerService.js';
import { LedgerService } from './services/LedgerService.js';
import { PixKeyService } from './services/PixKeyService.js';
import { ServiceSessionService } from './services/ServiceSessionService.js';
import { TransactionService } from './services/TransactionService.js';
import { TransferService } from './services/TransferService.js';
import { AccountController } from './controllers/AccountController.js';
import { AuthController } from './controllers/AuthController.js';
import { BeneficiaryController } from './controllers/BeneficiaryController.js';
import { CustomerController } from './controllers/CustomerController.js';
import { LedgerController } from './controllers/LedgerController.js';
import { PixKeyController } from './controllers/PixKeyController.js';
import { ServiceSessionController } from './controllers/ServiceSessionController.js';
import { TransactionController } from './controllers/TransactionController.js';

const userRepository = new UserRepository();
const customerRepository = new CustomerRepository();
const serviceSessionRepository = new ServiceSessionRepository();
const accountRepository = new AccountRepository();
const transactionRepository = new TransactionRepository();
const pixKeyRepository = new PixKeyRepository();
const beneficiaryRepository = new BeneficiaryRepository();

const authService = new AuthService(userRepository);
const customerService = new CustomerService(customerRepository);
const serviceSessionService = new ServiceSessionService(serviceSessionRepository, customerRepository);
const accountService = new AccountService(accountRepository);
const transactionService = new TransactionService(transactionRepository, accountRepository);
const transferService = new TransferService(accountRepository, pixKeyRepository, transactionRepository, transactionService);
const ledgerService = new LedgerService(transactionRepository);
const pixKeyService = new PixKeyService(pixKeyRepository, accountRepository, customerRepository);
const beneficiaryService = new BeneficiaryService(beneficiaryRepository, accountRepository, pixKeyRepository);

// Montar controllers com dependências da arquitetura em camadas
export const container = {
  authController: new AuthController(authService),
  customerController: new CustomerController(customerService),
  serviceSessionController: new ServiceSessionController(serviceSessionService),
  accountController: new AccountController(accountService),
  transactionController: new TransactionController(transactionService, transferService),
  ledgerController: new LedgerController(ledgerService),
  pixKeyController: new PixKeyController(pixKeyService),
  beneficiaryController: new BeneficiaryController(beneficiaryService),
  serviceSessionService,
};
