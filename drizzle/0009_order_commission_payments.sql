ALTER TABLE commission_payments ADD COLUMN selection_hash TEXT;
CREATE TABLE commission_order_allocations (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES orders(id),
 payment_id TEXT NOT NULL REFERENCES commission_payments(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 created_at TEXT NOT NULL,
 released_at TEXT
);
CREATE INDEX commission_allocations_order ON commission_order_allocations(order_id,released_at);
CREATE INDEX commission_allocations_payment ON commission_order_allocations(payment_id,released_at);
