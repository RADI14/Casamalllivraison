CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`tracking` text,
	`error` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
