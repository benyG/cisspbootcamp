-- AlterTable
ALTER TABLE `marketing_posts` ADD COLUMN `linkedin_urn` VARCHAR(120) NULL;

-- CreateTable
CREATE TABLE `linkedin_credentials` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `member_urn` VARCHAR(120) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `access_token_sealed` TEXT NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `connected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

