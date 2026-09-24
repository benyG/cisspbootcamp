-- CreateTable
CREATE TABLE `documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program` ENUM('cissp', 'cc') NOT NULL DEFAULT 'cissp',
    `name` VARCHAR(120) NOT NULL,
    `filename` VARCHAR(160) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `size` INTEGER NOT NULL,
    `content` LONGBLOB NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documents_program_active_idx`(`program`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

