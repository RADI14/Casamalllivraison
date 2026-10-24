ALTER TABLE ad_expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'MAD';
ALTER TABLE ad_expenses ADD COLUMN original_amount_cents INTEGER;
ALTER TABLE ad_expenses ADD COLUMN exchange_rate_micros INTEGER NOT NULL DEFAULT 1000000;
UPDATE ad_expenses SET original_amount_cents = amount_cents;
