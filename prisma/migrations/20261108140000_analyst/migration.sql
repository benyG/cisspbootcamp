-- The analyst of the week: snapshot, orientations, decisions.
CREATE TABLE `analyst_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `week_key` VARCHAR(10) NOT NULL,
    `snapshot` JSON NOT NULL,
    `output` JSON NOT NULL,
    `decisions` JSON NULL,
    `model` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `analyst_reports_week_key_key`(`week_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
