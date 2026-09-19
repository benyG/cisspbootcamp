-- CreateTable
CREATE TABLE `exchange_rates` (
    `currency` VARCHAR(3) NOT NULL,
    `per_usd` DOUBLE NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`currency`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

