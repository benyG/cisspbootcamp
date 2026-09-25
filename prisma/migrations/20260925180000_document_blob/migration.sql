-- AlterTable
ALTER TABLE `documents` ADD COLUMN `blob_pathname` VARCHAR(255) NULL,
    MODIFY `content` LONGBLOB NULL;

