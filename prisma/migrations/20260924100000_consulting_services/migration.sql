-- DropIndex
DROP INDEX `availability_rules_weekday_idx` ON `availability_rules`;
-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `kind` ENUM('discovery', 'consulting') NOT NULL DEFAULT 'discovery',
    ADD COLUMN `service_order_id` INTEGER NULL;
-- AlterTable
ALTER TABLE `registrations` ADD COLUMN `credit_usd` INTEGER NOT NULL DEFAULT 0;
-- AlterTable
ALTER TABLE `availability_rules` ADD COLUMN `kind` ENUM('discovery', 'consulting') NOT NULL DEFAULT 'discovery';
-- CreateTable
CREATE TABLE `services` (
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `tagline` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `deliverable` VARCHAR(200) NOT NULL,
    `session_minutes` INTEGER NOT NULL,
    `sessions` INTEGER NOT NULL DEFAULT 1,
    `creditable` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `service_prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service_code` VARCHAR(32) NOT NULL,
    `tier` VARCHAR(32) NOT NULL,
    `amount_usd` INTEGER NOT NULL,
    `netticket_ticket_code` VARCHAR(64) NULL,
    UNIQUE INDEX `service_prices_service_code_tier_key`(`service_code`, `tier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `service_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `service_code` VARCHAR(32) NOT NULL,
    `tier` VARCHAR(32) NOT NULL,
    `amount_usd` INTEGER NOT NULL,
    `currency_local` VARCHAR(3) NULL,
    `amount_local` INTEGER NULL,
    `method` ENUM('stripe', 'netticket') NOT NULL,
    `status` ENUM('pending', 'pending_manual', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
    `stripe_session_id` VARCHAR(255) NULL,
    `netticket_transaction_id` VARCHAR(255) NULL,
    `reference` VARCHAR(40) NOT NULL,
    `sessions_total` INTEGER NOT NULL,
    `booking_token` VARCHAR(64) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `credited_registration_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `service_orders_stripe_session_id_key`(`stripe_session_id`),
    UNIQUE INDEX `service_orders_netticket_transaction_id_key`(`netticket_transaction_id`),
    UNIQUE INDEX `service_orders_reference_key`(`reference`),
    UNIQUE INDEX `service_orders_booking_token_key`(`booking_token`),
    INDEX `service_orders_lead_id_status_idx`(`lead_id`, `status`),
    INDEX `service_orders_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateIndex
CREATE INDEX `bookings_service_order_id_idx` ON `bookings`(`service_order_id`);
-- CreateIndex
CREATE INDEX `availability_rules_kind_weekday_idx` ON `availability_rules`(`kind`, `weekday`);
-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_service_order_id_fkey` FOREIGN KEY (`service_order_id`) REFERENCES `service_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `service_prices` ADD CONSTRAINT `service_prices_service_code_fkey` FOREIGN KEY (`service_code`) REFERENCES `services`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_service_code_fkey` FOREIGN KEY (`service_code`) REFERENCES `services`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_credited_registration_id_fkey` FOREIGN KEY (`credited_registration_id`) REFERENCES `registrations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
