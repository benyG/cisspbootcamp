-- AlterTable
ALTER TABLE `cohorts` MODIFY `program` ENUM('cissp', 'cc', 'ia') NOT NULL DEFAULT 'cissp';

-- AlterTable
ALTER TABLE `replay_items` MODIFY `program` ENUM('cissp', 'cc', 'ia') NOT NULL DEFAULT 'cissp';

-- AlterTable
ALTER TABLE `program_prices` MODIFY `program` ENUM('cissp', 'cc', 'ia') NOT NULL;

-- AlterTable
ALTER TABLE `documents` MODIFY `program` ENUM('cissp', 'cc', 'ia') NOT NULL DEFAULT 'cissp';
