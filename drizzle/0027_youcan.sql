CREATE TABLE youcan_connections(store_id TEXT PRIMARY KEY,token_cipher TEXT NOT NULL,connected_at TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE youcan_launches(digest TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
CREATE TABLE youcan_orders(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,remote_id TEXT NOT NULL,reference TEXT NOT NULL,payload TEXT NOT NULL,source_updated_at TEXT NOT NULL,received_at TEXT NOT NULL,assigned_email TEXT,local_order_id TEXT,hydrated INTEGER NOT NULL DEFAULT 0,UNIQUE(store_id,remote_id));
