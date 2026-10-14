-- Evaluations (Ben, 14/10): ExamBoot tests and mock exams by domain, sent to cohort participants.

-- CreateTable
CREATE TABLE `evaluations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohort_id` INTEGER NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `kind` VARCHAR(10) NOT NULL,
    `questions` INTEGER NOT NULL,
    `timer` INTEGER NOT NULL DEFAULT 0,
    `domains` JSON NOT NULL,
    `message` TEXT NULL,
    `due_at` DATETIME(3) NOT NULL,
    `remind` BOOLEAN NOT NULL DEFAULT true,
    `reminded_at` DATETIME(3) NULL,
    `code` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `evaluations_code_key`(`code`),
    INDEX `evaluations_cohort_id_idx`(`cohort_id`),
    INDEX `evaluations_due_at_idx`(`due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluation_recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `evaluation_id` INTEGER NOT NULL,
    `lead_id` INTEGER NOT NULL,
    `external_id` INTEGER NOT NULL,
    `link` TEXT NOT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'created',
    `emailed_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `percent` INTEGER NULL,
    `correct` INTEGER NULL,
    `domains` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `evaluation_recipients_external_id_idx`(`external_id`),
    INDEX `evaluation_recipients_lead_id_idx`(`lead_id`),
    UNIQUE INDEX `evaluation_recipients_evaluation_id_lead_id_key`(`evaluation_id`, `lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `evaluation_recipients` ADD CONSTRAINT `evaluation_recipients_evaluation_id_fkey` FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `evaluation_recipients` ADD CONSTRAINT `evaluation_recipients_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
