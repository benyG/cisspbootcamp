-- AlterTable
ALTER TABLE `leads` ADD COLUMN `followup_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `tags` JSON NULL;

