-- IA privée et souveraine (Ben, 24/11): the request form's « données sur site » box.
-- AlterTable
ALTER TABLE `enterprise_requests` ADD COLUMN `data_on_site` BOOLEAN NOT NULL DEFAULT false;
