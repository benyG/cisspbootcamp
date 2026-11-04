-- AlterTable
ALTER TABLE `registrations` ADD COLUMN `balance_method` ENUM('stripe', 'netticket', 'manual') NULL,
    ADD COLUMN `balance_netticket_transaction_id` VARCHAR(255) NULL,
    ADD COLUMN `balance_note` VARCHAR(200) NULL,
    ADD COLUMN `balance_paid_at` DATETIME(3) NULL,
    ADD COLUMN `balance_reminders` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `balance_stripe_session_id` VARCHAR(255) NULL,
    ADD COLUMN `balance_usd` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `pricing_tiers` ADD COLUMN `installment_usd` INTEGER NULL,
    ADD COLUMN `netticket_installment_code` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `program_prices` ADD COLUMN `installment_usd` INTEGER NULL,
    ADD COLUMN `netticket_installment_code` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `registrations_balance_stripe_session_id_key` ON `registrations`(`balance_stripe_session_id`);

-- CreateIndex
CREATE UNIQUE INDEX `registrations_balance_netticket_transaction_id_key` ON `registrations`(`balance_netticket_transaction_id`);


-- Bâtisseur IA, two instalments as in the validated plan (2 × 310 USD in
-- Africa, 2 × 620 USD elsewhere), only where Ben kept the default price.
UPDATE `program_prices` SET `installment_usd` = 31000 WHERE `program` = 'ia' AND `tier` = 'africa' AND `amount_usd` = 59000 AND `installment_usd` IS NULL;
UPDATE `program_prices` SET `installment_usd` = 62000 WHERE `program` = 'ia' AND `tier` = 'international' AND `amount_usd` = 119000 AND `installment_usd` IS NULL;
