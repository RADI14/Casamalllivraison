ALTER TABLE youcan_orders ADD COLUMN review_status TEXT NOT NULL DEFAULT 'new' CHECK(review_status IN ('new','no_reply_1','no_reply_2','no_reply_3','no_reply_4','cancelled','confirmed'));
ALTER TABLE youcan_orders ADD COLUMN prepared_payload TEXT;
ALTER TABLE youcan_orders ADD COLUMN review_updated_at TEXT;
UPDATE youcan_orders SET review_status='confirmed' WHERE local_order_id IS NOT NULL;
