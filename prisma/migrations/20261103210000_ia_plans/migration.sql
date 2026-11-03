-- CreateTable
CREATE TABLE `ia_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `cohort_id` INTEGER NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ia_plans_token_key`(`token`),
    INDEX `ia_plans_cohort_id_idx`(`cohort_id`),
    UNIQUE INDEX `ia_plans_lead_id_cohort_id_key`(`lead_id`, `cohort_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ia_plans` ADD CONSTRAINT `ia_plans_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ia_plans` ADD CONSTRAINT `ia_plans_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

