-- CreateTable
CREATE TABLE `seat_holds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `cohort_id` INTEGER NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `reminder_sent_at` DATETIME(3) NULL,
    `released_at` DATETIME(3) NULL,
    `release_reason` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `seat_holds_cohort_id_released_at_expires_at_idx`(`cohort_id`, `released_at`, `expires_at`),
    INDEX `seat_holds_lead_id_idx`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `seat_holds` ADD CONSTRAINT `seat_holds_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `seat_holds` ADD CONSTRAINT `seat_holds_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

