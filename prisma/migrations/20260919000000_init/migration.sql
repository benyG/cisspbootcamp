-- CreateTable
CREATE TABLE `leads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(80) NOT NULL,
    `last_name` VARCHAR(80) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `whatsapp` VARCHAR(32) NULL,
    `country` VARCHAR(2) NOT NULL,
    `tier` VARCHAR(32) NOT NULL,
    `status` ENUM('new', 'contacted', 'booked', 'called', 'registered', 'nurture', 'lost') NOT NULL DEFAULT 'new',
    `heat_score` INTEGER NOT NULL DEFAULT 0,
    `readiness` ENUM('ready', 'conditional', 'not_yet') NULL,
    `consent_at` DATETIME(3) NULL,
    `source` VARCHAR(80) NULL,
    `utm_source` VARCHAR(120) NULL,
    `utm_medium` VARCHAR(120) NULL,
    `utm_campaign` VARCHAR(120) NULL,
    `utm_content` VARCHAR(120) NULL,
    `utm_term` VARCHAR(120) NULL,
    `next_followup_at` DATETIME(3) NULL,
    `unsubscribe_token` VARCHAR(64) NOT NULL,
    `unsubscribed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leads_email_key`(`email`),
    UNIQUE INDEX `leads_unsubscribe_token_key`(`unsubscribe_token`),
    INDEX `leads_status_heat_score_idx`(`status`, `heat_score`),
    INDEX `leads_next_followup_at_idx`(`next_followup_at`),
    INDEX `leads_tier_idx`(`tier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scanner_responses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `answers` JSON NOT NULL,
    `readiness` ENUM('ready', 'conditional', 'not_yet') NOT NULL,
    `heat_score` INTEGER NOT NULL,
    `result_token` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `scanner_responses_result_token_key`(`result_token`),
    INDEX `scanner_responses_lead_id_idx`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `google_event_id` VARCHAR(180) NULL,
    `meet_url` VARCHAR(255) NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `timezone` VARCHAR(64) NOT NULL,
    `status` ENUM('scheduled', 'done', 'no_show', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `outcome` ENUM('registered', 'to_follow_up', 'not_now', 'not_qualified', 'no_show') NULL,
    `notes` TEXT NULL,
    `reschedule_token` VARCHAR(64) NOT NULL,
    `reminded_at_24h` DATETIME(3) NULL,
    `reminded_at_1h` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_google_event_id_key`(`google_event_id`),
    UNIQUE INDEX `bookings_reschedule_token_key`(`reschedule_token`),
    INDEX `bookings_starts_at_idx`(`starts_at`),
    INDEX `bookings_lead_id_idx`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cohorts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 10,
    `status` ENUM('planned', 'open', 'full', 'running', 'done') NOT NULL DEFAULT 'planned',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cohorts_status_starts_at_idx`(`status`, `starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `registrations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `cohort_id` INTEGER NOT NULL,
    `tier` VARCHAR(32) NOT NULL,
    `amount_usd` INTEGER NOT NULL,
    `currency_local` VARCHAR(3) NULL,
    `amount_local` INTEGER NULL,
    `method` ENUM('stripe', 'netticket') NOT NULL,
    `status` ENUM('pending', 'pending_manual', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
    `stripe_session_id` VARCHAR(255) NULL,
    `netticket_transaction_id` VARCHAR(255) NULL,
    `reference` VARCHAR(40) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `registrations_stripe_session_id_key`(`stripe_session_id`),
    UNIQUE INDEX `registrations_netticket_transaction_id_key`(`netticket_transaction_id`),
    UNIQUE INDEX `registrations_reference_key`(`reference`),
    INDEX `registrations_cohort_id_status_idx`(`cohort_id`, `status`),
    INDEX `registrations_lead_id_idx`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pricing_tiers` (
    `code` VARCHAR(32) NOT NULL,
    `amount_usd` INTEGER NOT NULL,
    `countries` JSON NOT NULL,
    `label` VARCHAR(120) NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `testimonials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `role` VARCHAR(120) NULL,
    `country` VARCHAR(2) NULL,
    `text` TEXT NOT NULL,
    `video_url` VARCHAR(255) NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `testimonials_published_idx`(`published`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_templates` (
    `key` VARCHAR(64) NOT NULL,
    `channel` ENUM('email', 'whatsapp') NOT NULL,
    `subject` VARCHAR(255) NULL,
    `body` TEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actions_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NULL,
    `type` VARCHAR(64) NOT NULL,
    `channel` ENUM('email', 'whatsapp') NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `actions_log_lead_id_created_at_idx`(`lead_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_tier_fkey` FOREIGN KEY (`tier`) REFERENCES `pricing_tiers`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scanner_responses` ADD CONSTRAINT `scanner_responses_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registrations` ADD CONSTRAINT `registrations_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registrations` ADD CONSTRAINT `registrations_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actions_log` ADD CONSTRAINT `actions_log_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

