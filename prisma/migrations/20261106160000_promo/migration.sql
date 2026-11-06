-- Promo (lot 6): codes, and the promo applied to a registration.
ALTER TABLE `registrations` ADD COLUMN `promo_code` VARCHAR(24) NULL,
    ADD COLUMN `discount_usd` INTEGER NOT NULL DEFAULT 0;
CREATE INDEX `registrations_promo_code_idx` ON `registrations`(`promo_code`);

CREATE TABLE `promo_codes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(24) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `percent` INTEGER NOT NULL,
    `program` VARCHAR(8) NULL,
    `valid_until` DATETIME(3) NULL,
    `max_uses` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `referrer_lead_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `promo_codes_code_key`(`code`),
    INDEX `promo_codes_referrer_lead_id_idx`(`referrer_lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
