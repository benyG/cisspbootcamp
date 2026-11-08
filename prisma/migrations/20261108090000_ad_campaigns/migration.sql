-- Paid campaigns (lot 8): tracked link code, spend typed by Ben.
CREATE TABLE `ad_campaigns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(48) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `channel` VARCHAR(16) NOT NULL,
    `destination` VARCHAR(16) NOT NULL,
    `cohort_id` INTEGER NULL,
    `budget_usd` INTEGER NULL,
    `spent_cents` INTEGER NOT NULL DEFAULT 0,
    `spent_updated_at` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ad_campaigns_code_key`(`code`),
    INDEX `ad_campaigns_cohort_id_idx`(`cohort_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ad_campaigns` ADD CONSTRAINT `ad_campaigns_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
