-- CreateTable
CREATE TABLE `ia_days` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` VARCHAR(10) NOT NULL,
    `journee` TINYINT NOT NULL,
    `start` VARCHAR(5) NOT NULL DEFAULT '10:00',
    `capacity` INTEGER NOT NULL DEFAULT 12,
    `closed` BOOLEAN NOT NULL DEFAULT false,
    `cohort_id` INTEGER NULL,
    `event_id` VARCHAR(255) NULL,
    `meet_url` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `ia_days_date_key`(`date`),
    UNIQUE INDEX `ia_days_cohort_id_key`(`cohort_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `ia_seats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `day_id` INTEGER NOT NULL,
    `lead_id` INTEGER NOT NULL,
    `cohort_id` INTEGER NOT NULL,
    `journee` TINYINT NOT NULL,
    `invited_at` DATETIME(3) NULL,
    `reminded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `ia_seats_day_id_idx`(`day_id`),
    UNIQUE INDEX `ia_seats_lead_id_cohort_id_journee_key`(`lead_id`, `cohort_id`, `journee`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- AddForeignKey
ALTER TABLE `ia_days` ADD CONSTRAINT `ia_days_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `ia_seats` ADD CONSTRAINT `ia_seats_day_id_fkey` FOREIGN KEY (`day_id`) REFERENCES `ia_days`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `ia_seats` ADD CONSTRAINT `ia_seats_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `ia_seats` ADD CONSTRAINT `ia_seats_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
