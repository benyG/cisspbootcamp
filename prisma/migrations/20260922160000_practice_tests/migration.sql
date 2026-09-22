-- CreateTable
CREATE TABLE `practice_tests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(80) NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `placement` VARCHAR(40) NOT NULL,
    `lead_id` INTEGER NULL,
    `visitor_id` VARCHAR(48) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `questions` INTEGER NOT NULL DEFAULT 5,
    `nickname` VARCHAR(80) NULL,
    `percent` INTEGER NULL,
    `correct` INTEGER NULL,
    `finished_at` DATETIME(3) NULL,
    `checked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `practice_tests_code_key`(`code`),
    INDEX `practice_tests_lead_id_created_at_idx`(`lead_id`, `created_at`),
    INDEX `practice_tests_status_created_at_idx`(`status`, `created_at`),
    INDEX `practice_tests_placement_created_at_idx`(`placement`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `practice_tests` ADD CONSTRAINT `practice_tests_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

