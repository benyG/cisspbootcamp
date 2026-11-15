-- Lot D: read-only MCP clients, continuous quote numbers.
-- AlterTable
ALTER TABLE `quote_requests` ADD COLUMN `quote_number` VARCHAR(20) NULL;

-- AlterTable
ALTER TABLE `mcp_clients` ADD COLUMN `read_only` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `quote_requests_quote_number_key` ON `quote_requests`(`quote_number`);

