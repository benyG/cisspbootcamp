-- CreateTable
CREATE TABLE `cohort_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohort_id` INTEGER NOT NULL,
    `day` INTEGER NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `timezone` VARCHAR(64) NOT NULL,
    `pause_minutes` INTEGER NOT NULL DEFAULT 0,
    `google_event_id` VARCHAR(255) NULL,
    `meet_url` VARCHAR(255) NULL,
    `guest_email` VARCHAR(200) NULL,
    `reminder` BOOLEAN NOT NULL DEFAULT true,
    `invited_count` INTEGER NOT NULL DEFAULT 0,
    `sent_at` DATETIME(3) NULL,
    `reminded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cohort_sessions_starts_at_idx`(`starts_at`),
    UNIQUE INDEX `cohort_sessions_cohort_id_day_key`(`cohort_id`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cohort_sessions` ADD CONSTRAINT `cohort_sessions_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

