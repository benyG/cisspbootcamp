-- DropIndex
DROP INDEX `cohorts_status_starts_at_idx` ON `cohorts`;

-- AlterTable
ALTER TABLE `cohorts` ADD COLUMN `program` ENUM('cissp', 'cc') NOT NULL DEFAULT 'cissp';

-- CreateTable
CREATE TABLE `program_prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program` ENUM('cissp', 'cc') NOT NULL,
    `tier` VARCHAR(32) NOT NULL,
    `amount_usd` INTEGER NOT NULL,
    `netticket_ticket_code` VARCHAR(64) NULL,

    UNIQUE INDEX `program_prices_program_tier_key`(`program`, `tier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `cohorts_program_status_starts_at_idx` ON `cohorts`(`program`, `status`, `starts_at`);

