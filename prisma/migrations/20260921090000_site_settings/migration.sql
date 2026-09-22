-- AlterTable
ALTER TABLE `testimonials` ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `site_settings` (
    `key` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

