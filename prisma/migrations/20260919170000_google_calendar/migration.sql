-- CreateTable
CREATE TABLE `google_credentials` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `account_email` VARCHAR(180) NOT NULL,
    `refresh_token_sealed` VARCHAR(512) NOT NULL,
    `calendar_id` VARCHAR(255) NOT NULL DEFAULT 'primary',
    `time_zone` VARCHAR(64) NOT NULL DEFAULT 'Africa/Douala',
    `connected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `availability_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `weekday` INTEGER NOT NULL,
    `start` VARCHAR(5) NOT NULL,
    `end` VARCHAR(5) NOT NULL,

    INDEX `availability_rules_weekday_idx`(`weekday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

