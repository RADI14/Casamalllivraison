CREATE TABLE carrier_receipts (
 id TEXT PRIMARY KEY NOT NULL,
 reference TEXT NOT NULL UNIQUE,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 received_on TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 voided_at TEXT,
 voided_by TEXT
);
