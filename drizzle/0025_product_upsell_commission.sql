CREATE TABLE product_commission_settings(sku TEXT PRIMARY KEY,upsell INTEGER NOT NULL DEFAULT 0 CHECK(upsell IN (0,1)),updated_at TEXT NOT NULL,updated_by TEXT NOT NULL);
ALTER TABLE orders ADD COLUMN commission_multiplier INTEGER NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN commission_upsell_stock_ids TEXT NOT NULL DEFAULT '[]';
