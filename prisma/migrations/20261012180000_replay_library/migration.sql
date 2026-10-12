-- Replay library (Ben, 12/10): recordings are filed by program and module,
-- no longer by cohort. Rows already uploaded are kept: each per-cohort
-- replay becomes a library item, and its grants keep their cohort.

-- CreateTable
CREATE TABLE `replay_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program` ENUM('cissp', 'cc') NOT NULL DEFAULT 'cissp',
    `title` VARCHAR(200) NOT NULL,
    `modules` JSON NULL,
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
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `replay_items_program_video_status_idx`(`program`, `video_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Existing per-cohort replays become library items (same ids, modules to set).
INSERT INTO `replay_items` (`id`, `program`, `title`, `modules`, `stream_uid`, `video_status`, `video_name`, `video_error`, `duration_sec`, `source`, `drive_file_id`, `tus_url`, `source_size`, `transfer_offset`, `lab_pathname`, `lab_name`, `lab_size`, `created_at`, `updated_at`)
SELECT r.`id`, c.`program`, LEFT(CONCAT('Enregistrement J', r.`day`, ' · ', c.`name`), 200), NULL, r.`stream_uid`, r.`video_status`, r.`video_name`, r.`video_error`, r.`duration_sec`, r.`source`, r.`drive_file_id`, r.`tus_url`, r.`source_size`, r.`transfer_offset`, r.`lab_pathname`, r.`lab_name`, r.`lab_size`, r.`created_at`, r.`updated_at`
FROM `cohort_replays` r JOIN `cohorts` c ON c.`id` = r.`cohort_id`;

-- Grants: point at the item and keep the cohort they were given in.
ALTER TABLE `replay_grants` DROP FOREIGN KEY `replay_grants_replay_id_fkey`;
DROP INDEX `replay_grants_replay_id_lead_id_key` ON `replay_grants`;
ALTER TABLE `replay_grants` ADD COLUMN `cohort_id` INTEGER NULL, ADD COLUMN `item_id` INTEGER NULL;
UPDATE `replay_grants` g JOIN `cohort_replays` r ON r.`id` = g.`replay_id` SET g.`item_id` = r.`id`, g.`cohort_id` = r.`cohort_id`;
DELETE FROM `replay_grants` WHERE `item_id` IS NULL OR `cohort_id` IS NULL;
ALTER TABLE `replay_grants` DROP COLUMN `replay_id`, MODIFY `cohort_id` INTEGER NOT NULL, MODIFY `item_id` INTEGER NOT NULL;

-- DropTable
ALTER TABLE `cohort_replays` DROP FOREIGN KEY `cohort_replays_cohort_id_fkey`;
DROP TABLE `cohort_replays`;

-- CreateIndex
CREATE INDEX `replay_grants_cohort_id_lead_id_idx` ON `replay_grants`(`cohort_id`, `lead_id`);
CREATE UNIQUE INDEX `replay_grants_item_id_cohort_id_lead_id_key` ON `replay_grants`(`item_id`, `cohort_id`, `lead_id`);

-- AddForeignKey
ALTER TABLE `replay_grants` ADD CONSTRAINT `replay_grants_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `replay_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `replay_grants` ADD CONSTRAINT `replay_grants_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
