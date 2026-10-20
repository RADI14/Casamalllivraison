CREATE TABLE atlas_parcel_actions (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), actor TEXT NOT NULL, request_json TEXT NOT NULL, status TEXT NOT NULL, response_json TEXT, created_at TEXT NOT NULL);
CREATE INDEX atlas_parcel_actions_order ON atlas_parcel_actions(order_id,created_at);
