CREATE TABLE youcan_cod_backfill_jobs (
 store_id TEXT PRIMARY KEY,
 after_id TEXT NOT NULL DEFAULT '',
 done INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0,
 adjusted INTEGER NOT NULL DEFAULT 0,
 review_refs TEXT NOT NULL DEFAULT '[]'
);
