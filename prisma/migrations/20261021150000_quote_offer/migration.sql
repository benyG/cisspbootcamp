-- The service offer prepared for a quote request (Ben, 21/10).
ALTER TABLE `quote_requests` ADD COLUMN `offer` JSON NULL;
