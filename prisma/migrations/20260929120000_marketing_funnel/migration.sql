-- AlterTable
ALTER TABLE `practice_tests` ADD COLUMN `campaign_code` VARCHAR(40) NULL;

-- AlterTable
ALTER TABLE `marketing_posts` ADD COLUMN `destination` VARCHAR(20) NOT NULL DEFAULT 'scanner';

-- CreateIndex
CREATE INDEX `practice_tests_campaign_code_idx` ON `practice_tests`(`campaign_code`);

