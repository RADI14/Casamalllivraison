ALTER TABLE youcan_orders ADD COLUMN duplicate_of TEXT;
CREATE INDEX youcan_orders_visible ON youcan_orders(store_id,duplicate_of,received_at);
