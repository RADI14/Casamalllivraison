CREATE TABLE `ad_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`channel` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`cost_cents` integer NOT NULL,
	`sale_cents` integer NOT NULL,
	`transport_cents` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`order_id` text,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `product_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `unit_cost_cents` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `transport_estimate_cents` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `transport_actual_cents` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `transport_override_cents` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `stock_released` integer DEFAULT 0 NOT NULL;