-- AlterTable
ALTER TABLE `registrations` ADD COLUMN `payment_note` VARCHAR(200) NULL,
    MODIFY `method` ENUM('stripe', 'netticket', 'manual') NOT NULL;

-- AlterTable
ALTER TABLE `service_orders` MODIFY `method` ENUM('stripe', 'netticket', 'manual') NOT NULL;

