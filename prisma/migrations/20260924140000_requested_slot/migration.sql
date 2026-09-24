-- AlterTable
ALTER TABLE `service_orders` ADD COLUMN `requested_start` DATETIME(3) NULL,
    ADD COLUMN `requested_timezone` VARCHAR(64) NULL;

