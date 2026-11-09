-- The MCP plug: registered clients and their OAuth codes and tokens (hashed).
CREATE TABLE `mcp_clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `redirect_uris` JSON NOT NULL,
    `secret_hash` VARCHAR(64) NULL,
    `authorized_at` DATETIME(3) NULL,
    `last_used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mcp_clients_client_id_key`(`client_id`),
    INDEX `mcp_clients_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `mcp_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` VARCHAR(8) NOT NULL,
    `hash` VARCHAR(64) NOT NULL,
    `client_id` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `code_challenge` VARCHAR(128) NULL,
    `redirect_uri` VARCHAR(512) NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mcp_tokens_hash_key`(`hash`),
    INDEX `mcp_tokens_client_id_kind_idx`(`client_id`, `kind`),
    INDEX `mcp_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `mcp_tokens` ADD CONSTRAINT `mcp_tokens_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `mcp_clients`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;
