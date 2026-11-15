ALTER TABLE youcan_orders ADD COLUMN deleted_at TEXT;
ALTER TABLE youcan_orders ADD COLUMN deleted_by TEXT;
CREATE INDEX youcan_orders_trash ON youcan_orders(store_id,deleted_at,received_at);
