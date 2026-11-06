-- Cohort goal for the pilotage (lot 2): null means the capacity.
ALTER TABLE `cohorts` ADD COLUMN `target_seats` INTEGER NULL;
