-- Lot 7: planned LinkedIn publication and drafts proposed by the content rhythm playbook.
ALTER TABLE `marketing_posts` ADD COLUMN `scheduled_for` DATETIME(3) NULL,
    ADD COLUMN `scheduled_image_id` INTEGER NULL,
    ADD COLUMN `publish_error` VARCHAR(300) NULL,
    ADD COLUMN `auto_draft` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `marketing_posts_scheduled_for_idx` ON `marketing_posts`(`scheduled_for`);
