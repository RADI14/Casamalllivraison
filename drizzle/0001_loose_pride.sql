CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `created_email` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `atlas_state` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `atlas_state_name` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `synced_at` text;