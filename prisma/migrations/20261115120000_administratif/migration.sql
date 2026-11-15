-- Lot B · Administratif: numbered receipts, data requests, deadlines, anonymisation.
ALTER TABLE `leads` ADD COLUMN `anonymized_at` DATETIME(3) NULL;

CREATE TABLE `sequences` (
    `name` VARCHAR(32) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `receipts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(20) NOT NULL,
    `source` VARCHAR(32) NOT NULL,
    `kind` VARCHAR(12) NOT NULL,
    `lead_id` INTEGER NULL,
    `registration_id` INTEGER NULL,
    `service_order_id` INTEGER NULL,
    `reference` VARCHAR(40) NOT NULL,
    `buyer_name` VARCHAR(170) NOT NULL,
    `buyer_email` VARCHAR(180) NOT NULL,
    `buyer_country` VARCHAR(2) NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `amount_usd` INTEGER NOT NULL,
    `method` ENUM('stripe', 'netticket', 'manual') NOT NULL,
    `payment_note` VARCHAR(200) NULL,
    `paid_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `receipts_number_key`(`number`),
    UNIQUE INDEX `receipts_source_key`(`source`),
    INDEX `receipts_paid_at_idx`(`paid_at`),
    INDEX `receipts_lead_id_idx`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `privacy_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NULL,
    `email` VARCHAR(180) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `note` TEXT NULL,
    `received_at` DATETIME(3) NOT NULL,
    `due_at` DATETIME(3) NOT NULL,
    `done_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `privacy_requests_done_at_due_at_idx`(`done_at`, `due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_deadlines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(160) NOT NULL,
    `due_at` DATETIME(3) NOT NULL,
    `recurrence` VARCHAR(10) NOT NULL DEFAULT 'none',
    `note` TEXT NULL,
    `done_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_deadlines_done_at_due_at_idx`(`done_at`, `due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `receipts` ADD CONSTRAINT `receipts_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `privacy_requests` ADD CONSTRAINT `privacy_requests_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
