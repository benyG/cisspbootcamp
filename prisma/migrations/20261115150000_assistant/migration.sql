-- Lot C · Assistant du site: conversations (30 days) and questions handed to Ben.
-- CreateTable
CREATE TABLE `assistant_conversations` (
    `id` VARCHAR(32) NOT NULL,
    `program` VARCHAR(8) NOT NULL,
    `ip_hash` VARCHAR(64) NOT NULL,
    `turns` INTEGER NOT NULL DEFAULT 0,
    `transcript` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `assistant_conversations_ip_hash_created_at_idx`(`ip_hash`, `created_at`),
    INDEX `assistant_conversations_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversation_id` VARCHAR(32) NULL,
    `email` VARCHAR(180) NOT NULL,
    `question` TEXT NOT NULL,
    `consent_at` DATETIME(3) NOT NULL,
    `answered_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `site_questions_answered_at_created_at_idx`(`answered_at`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `site_questions` ADD CONSTRAINT `site_questions_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `assistant_conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

