-- Bâtisseur IA Entreprises: company requests, their scoping call, proposal and deposit.
-- AlterTable
ALTER TABLE `bookings` MODIFY `kind` ENUM('discovery', 'consulting', 'enterprise') NOT NULL DEFAULT 'discovery';

-- AlterTable
ALTER TABLE `availability_rules` MODIFY `kind` ENUM('discovery', 'consulting', 'enterprise') NOT NULL DEFAULT 'discovery';

-- CreateTable
CREATE TABLE `enterprise_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(64) NOT NULL,
    `lead_id` INTEGER NULL,
    `organization` VARCHAR(160) NOT NULL,
    `country` VARCHAR(2) NOT NULL,
    `contact_name` VARCHAR(120) NOT NULL,
    `job_title` VARCHAR(120) NULL,
    `email` VARCHAR(180) NOT NULL,
    `size` VARCHAR(8) NOT NULL,
    `functions` JSON NOT NULL,
    `need` TEXT NULL,
    `consent_at` DATETIME(3) NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'new',
    `note` TEXT NULL,
    `proposal` JSON NULL,
    `quote_number` VARCHAR(20) NULL,
    `deposit_usd` INTEGER NULL,
    `deposit_reference` VARCHAR(40) NULL,
    `deposit_stripe_session_id` VARCHAR(255) NULL,
    `deposit_method` ENUM('stripe', 'netticket', 'manual') NULL,
    `deposit_note` VARCHAR(200) NULL,
    `deposit_paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `enterprise_requests_token_key`(`token`),
    UNIQUE INDEX `enterprise_requests_quote_number_key`(`quote_number`),
    UNIQUE INDEX `enterprise_requests_deposit_reference_key`(`deposit_reference`),
    UNIQUE INDEX `enterprise_requests_deposit_stripe_session_id_key`(`deposit_stripe_session_id`),
    INDEX `enterprise_requests_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `enterprise_requests` ADD CONSTRAINT `enterprise_requests_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

