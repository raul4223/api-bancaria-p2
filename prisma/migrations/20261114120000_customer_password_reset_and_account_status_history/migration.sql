-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `passwordChangedAt` DATETIME(3) NULL,
    ADD COLUMN `passwordChangedByUserId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `AccountStatusHistory` (
    `id` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `operatorUserId` CHAR(36) NOT NULL,
    `fromStatus` ENUM('ACTIVE', 'BLOCKED') NOT NULL,
    `toStatus` ENUM('ACTIVE', 'BLOCKED') NOT NULL,
    `reason` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AccountStatusHistory_accountId_createdAt_idx`(`accountId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_passwordChangedByUserId_fkey` FOREIGN KEY (`passwordChangedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountStatusHistory` ADD CONSTRAINT `AccountStatusHistory_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountStatusHistory` ADD CONSTRAINT `AccountStatusHistory_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
