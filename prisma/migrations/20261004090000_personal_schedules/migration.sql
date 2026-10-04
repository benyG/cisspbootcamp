-- CreateTable
CREATE TABLE `personal_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohort_id` INTEGER NOT NULL,
    `lead_id` INTEGER NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'invited',
    `sent_at` DATETIME(3) NOT NULL,
    `days` JSON NULL,
    `proposed_at` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `refused_at` DATETIME(3) NULL,
    `refusal_note` TEXT NULL,
    `events` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `personal_schedules_token_key`(`token`),
    INDEX `personal_schedules_status_idx`(`status`),
    UNIQUE INDEX `personal_schedules_cohort_id_lead_id_key`(`cohort_id`, `lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `personal_schedules` ADD CONSTRAINT `personal_schedules_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `personal_schedules` ADD CONSTRAINT `personal_schedules_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

