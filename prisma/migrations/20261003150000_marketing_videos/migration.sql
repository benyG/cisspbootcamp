-- CreateTable
CREATE TABLE `marketing_videos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `post_id` INTEGER NOT NULL,
    `prompt` TEXT NOT NULL,
    `model` VARCHAR(60) NOT NULL,
    `duration` INTEGER NOT NULL DEFAULT 6,
    `task_id` VARCHAR(80) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'queued',
    `error` VARCHAR(300) NULL,
    `blob_pathname` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `marketing_videos_status_created_at_idx`(`status`, `created_at`),
    INDEX `marketing_videos_post_id_idx`(`post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `marketing_videos` ADD CONSTRAINT `marketing_videos_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `marketing_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

