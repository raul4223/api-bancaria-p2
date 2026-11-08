-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `cpf` CHAR(11) NOT NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(20) NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `failedPasswordAttempts` INTEGER NOT NULL DEFAULT 0,
    `passwordLockedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_cpf_key`(`cpf`),
    UNIQUE INDEX `Customer_email_key`(`email`),
    INDEX `Customer_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceSession` (
    `id` CHAR(36) NOT NULL,
    `operatorUserId` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED', 'EXPIRED') NOT NULL DEFAULT 'OPEN',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,

    INDEX `ServiceSession_operatorUserId_status_idx`(`operatorUserId`, `status`),
    INDEX `ServiceSession_customerId_openedAt_idx`(`customerId`, `openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NULL,
    `agency` CHAR(4) NOT NULL,
    `number` VARCHAR(12) NOT NULL,
    `type` ENUM('CHECKING', 'SAVINGS', 'SYSTEM') NOT NULL,
    `status` ENUM('ACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `blockReason` VARCHAR(240) NULL,
    `blockedAt` DATETIME(3) NULL,
    `blockedByUserId` CHAR(36) NULL,
    `balanceCents` BIGINT NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Account_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `Account_status_type_idx`(`status`, `type`),
    UNIQUE INDEX `Account_agency_number_key`(`agency`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BankTransaction` (
    `id` CHAR(36) NOT NULL,
    `operatorUserId` CHAR(36) NOT NULL,
    `serviceSessionId` CHAR(36) NOT NULL,
    `type` ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER') NOT NULL,
    `transferType` ENUM('PIX', 'TED', 'INTERNAL') NULL,
    `amountCents` BIGINT NOT NULL,
    `feeCents` BIGINT NOT NULL DEFAULT 0,
    `sourceAccountId` CHAR(36) NULL,
    `destinationAccountId` CHAR(36) NULL,
    `pixKeyUsed` VARCHAR(254) NULL,
    `description` VARCHAR(240) NULL,
    `idempotencyKey` VARCHAR(120) NOT NULL,
    `requestFingerprint` CHAR(64) NOT NULL,
    `status` ENUM('SUCCESS') NOT NULL DEFAULT 'SUCCESS',
    `resultData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BankTransaction_serviceSessionId_createdAt_idx`(`serviceSessionId`, `createdAt`),
    INDEX `BankTransaction_sourceAccountId_createdAt_idx`(`sourceAccountId`, `createdAt`),
    INDEX `BankTransaction_destinationAccountId_createdAt_idx`(`destinationAccountId`, `createdAt`),
    UNIQUE INDEX `BankTransaction_operatorUserId_idempotencyKey_key`(`operatorUserId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LedgerEntry` (
    `id` CHAR(36) NOT NULL,
    `transactionId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `direction` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `amountCents` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerEntry_accountId_createdAt_idx`(`accountId`, `createdAt`),
    INDEX `LedgerEntry_transactionId_idx`(`transactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PixKey` (
    `id` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `keyType` ENUM('CPF', 'EMAIL', 'PHONE', 'RANDOM') NOT NULL,
    `keyValue` VARCHAR(254) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PixKey_keyValue_key`(`keyValue`),
    INDEX `PixKey_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `PixKey_accountId_createdAt_idx`(`accountId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Beneficiary` (
    `id` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `nickname` VARCHAR(80) NOT NULL,
    `transferType` ENUM('PIX', 'TED', 'INTERNAL') NOT NULL,
    `pixKey` VARCHAR(254) NULL,
    `destinationAgency` CHAR(4) NULL,
    `destinationAccountNumber` VARCHAR(12) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Beneficiary_customerId_createdAt_idx`(`customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ServiceSession` ADD CONSTRAINT `ServiceSession_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceSession` ADD CONSTRAINT `ServiceSession_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_blockedByUserId_fkey` FOREIGN KEY (`blockedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankTransaction` ADD CONSTRAINT `BankTransaction_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankTransaction` ADD CONSTRAINT `BankTransaction_serviceSessionId_fkey` FOREIGN KEY (`serviceSessionId`) REFERENCES `ServiceSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankTransaction` ADD CONSTRAINT `BankTransaction_sourceAccountId_fkey` FOREIGN KEY (`sourceAccountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankTransaction` ADD CONSTRAINT `BankTransaction_destinationAccountId_fkey` FOREIGN KEY (`destinationAccountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerEntry` ADD CONSTRAINT `LedgerEntry_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `BankTransaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerEntry` ADD CONSTRAINT `LedgerEntry_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PixKey` ADD CONSTRAINT `PixKey_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PixKey` ADD CONSTRAINT `PixKey_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Beneficiary` ADD CONSTRAINT `Beneficiary_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
