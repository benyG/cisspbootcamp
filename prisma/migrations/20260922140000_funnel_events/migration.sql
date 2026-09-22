-- CreateTable
CREATE TABLE `funnel_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitor_id` VARCHAR(48) NULL,
    `lead_id` INTEGER NULL,
    `name` VARCHAR(40) NOT NULL,
    `step` INTEGER NULL,
    `label` VARCHAR(160) NULL,
    `country` VARCHAR(2) NULL,
    `utm_source` VARCHAR(120) NULL,
    `utm_medium` VARCHAR(120) NULL,
    `utm_campaign` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `funnel_events_name_created_at_idx`(`name`, `created_at`),
    INDEX `funnel_events_visitor_id_created_at_idx`(`visitor_id`, `created_at`),
    INDEX `funnel_events_lead_id_idx`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `funnel_events` ADD CONSTRAINT `funnel_events_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

