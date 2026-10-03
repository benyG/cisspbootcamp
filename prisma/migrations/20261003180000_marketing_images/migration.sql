-- CreateTable
CREATE TABLE `marketing_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `post_id` INTEGER NOT NULL,
    `scene` TEXT NOT NULL,
    `headline` VARCHAR(120) NOT NULL,
    `keyword` VARCHAR(60) NOT NULL,
    `model` VARCHAR(60) NOT NULL,
    `photo_pathname` VARCHAR(255) NOT NULL,
    `image_pathname` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `marketing_images_post_id_idx`(`post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `marketing_images` ADD CONSTRAINT `marketing_images_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `marketing_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

