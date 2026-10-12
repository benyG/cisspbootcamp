-- CreateTable
CREATE TABLE `cohort_replays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohort_id` INTEGER NOT NULL,
    `day` INTEGER NOT NULL,
    `stream_uid` VARCHAR(64) NULL,
    `video_status` VARCHAR(20) NOT NULL DEFAULT 'none',
    `video_name` VARCHAR(255) NULL,
    `video_error` VARCHAR(300) NULL,
    `duration_sec` INTEGER NULL,
    `source` VARCHAR(10) NULL,
    `drive_file_id` VARCHAR(120) NULL,
    `tus_url` TEXT NULL,
    `source_size` BIGINT NULL,
    `transfer_offset` BIGINT NULL,
    `lab_pathname` VARCHAR(255) NULL,
    `lab_name` VARCHAR(255) NULL,
    `lab_size` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cohort_replays_video_status_idx`(`video_status`),
    UNIQUE INDEX `cohort_replays_cohort_id_day_key`(`cohort_id`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `replay_grants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `replay_id` INTEGER NOT NULL,
    `lead_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `replay_grants_lead_id_idx`(`lead_id`),
    UNIQUE INDEX `replay_grants_replay_id_lead_id_key`(`replay_id`, `lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `replay_accesses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohort_id` INTEGER NOT NULL,
    `lead_id` INTEGER NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `requested_at` DATETIME(3) NULL,
    `request_note` TEXT NULL,
    `last_viewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `replay_accesses_token_key`(`token`),
    UNIQUE INDEX `replay_accesses_cohort_id_lead_id_key`(`cohort_id`, `lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cohort_replays` ADD CONSTRAINT `cohort_replays_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replay_grants` ADD CONSTRAINT `replay_grants_replay_id_fkey` FOREIGN KEY (`replay_id`) REFERENCES `cohort_replays`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replay_grants` ADD CONSTRAINT `replay_grants_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replay_accesses` ADD CONSTRAINT `replay_accesses_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replay_accesses` ADD CONSTRAINT `replay_accesses_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

