-- Sensitive actions prepared through the MCP plug, waiting for Ben's click.
CREATE TABLE `mcp_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` VARCHAR(24) NOT NULL,
    `payload` JSON NOT NULL,
    `summary` TEXT NOT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'pending',
    `result` TEXT NULL,
    `client_name` VARCHAR(120) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `decided_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mcp_requests_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
