-- Add settings table for app configuration
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);

-- Create unique index on key column
CREATE UNIQUE INDEX `idx_settings_key` ON `settings` (`key`);