-- AlterTable
ALTER TABLE `leads` ADD COLUMN `goals` TEXT NULL,
    ADD COLUMN `job_title` VARCHAR(120) NULL;

-- AlterTable
ALTER TABLE `scanner_responses` ADD COLUMN `analysis` JSON NOT NULL,
    ADD COLUMN `coach_message` TEXT NOT NULL,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL,
    ADD COLUMN `sent_at` DATETIME(3) NULL,
    ADD COLUMN `status` ENUM('pending_review', 'approved', 'sent', 'set_aside') NOT NULL DEFAULT 'pending_review';

-- CreateIndex
CREATE INDEX `scanner_responses_status_created_at_idx` ON `scanner_responses`(`status`, `created_at`);

