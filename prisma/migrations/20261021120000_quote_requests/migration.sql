-- Company quote requests (Ben, 21/10).

-- CreateTable
CREATE TABLE `quote_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization` VARCHAR(160) NOT NULL,
    `country` VARCHAR(80) NOT NULL,
    `contact_name` VARCHAR(120) NOT NULL,
    `job_title` VARCHAR(120) NULL,
    `email` VARCHAR(180) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `certification` VARCHAR(12) NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `headcount` VARCHAR(10) NOT NULL,
    `timing` VARCHAR(10) NOT NULL,
    `need` TEXT NULL,
    `consent_at` DATETIME(3) NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'new',
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quote_requests_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
