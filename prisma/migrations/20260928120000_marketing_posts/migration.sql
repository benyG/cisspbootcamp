-- CreateTable
CREATE TABLE `marketing_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohort_id` INTEGER NULL,
    `channel` VARCHAR(32) NOT NULL,
    `angle` VARCHAR(48) NOT NULL,
    `code` VARCHAR(24) NOT NULL,
    `text` TEXT NOT NULL,
    `visual_brief` TEXT NOT NULL,
    `video` TEXT NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `marketing_posts_code_key`(`code`),
    INDEX `marketing_posts_cohort_id_created_at_idx`(`cohort_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `marketing_posts` ADD CONSTRAINT `marketing_posts_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

