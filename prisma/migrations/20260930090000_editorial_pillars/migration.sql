-- AlterTable
ALTER TABLE `funnel_events` ADD COLUMN `utm_content` VARCHAR(120) NULL;

-- AlterTable
ALTER TABLE `marketing_posts` ADD COLUMN `format` VARCHAR(32) NULL,
    ADD COLUMN `pillar` VARCHAR(32) NULL,
    ADD COLUMN `topic` VARCHAR(240) NULL;

-- CreateIndex
CREATE INDEX `funnel_events_utm_content_idx` ON `funnel_events`(`utm_content`);

