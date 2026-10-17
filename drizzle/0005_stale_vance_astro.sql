CREATE TABLE `commission_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_at` text NOT NULL,
	`paid_by` text NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
