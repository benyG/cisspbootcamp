-- CreateTable
CREATE TABLE `ia_diagnostics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `answers` JSON NOT NULL,
    `result` JSON NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ia_diagnostics_token_key`(`token`),
    INDEX `ia_diagnostics_lead_id_idx`(`lead_id`),
    INDEX `ia_diagnostics_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ia_diagnostics` ADD CONSTRAINT `ia_diagnostics_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
