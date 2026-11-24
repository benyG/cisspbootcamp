-- The library (Ben, 24/11): internal files (slides, trainer files) are never sent to participants.
-- AlterTable
ALTER TABLE `documents` ADD COLUMN `audience` VARCHAR(16) NOT NULL DEFAULT 'participants';
-- CreateIndex
CREATE INDEX `documents_audience_idx` ON `documents`(`audience`);
