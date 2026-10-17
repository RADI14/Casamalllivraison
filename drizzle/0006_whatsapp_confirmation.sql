CREATE TABLE IF NOT EXISTS whatsapp_conversations (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), phone TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'waiting', paused INTEGER NOT NULL DEFAULT 1,
 consent_at TEXT, created_by TEXT NOT NULL, order_snapshot TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_inbound_at TEXT, error TEXT,
 ai_lock_until INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_one_active_phone ON whatsapp_conversations(phone) WHERE status IN ('waiting','review');
CREATE TABLE IF NOT EXISTS whatsapp_messages (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES whatsapp_conversations(id),
 provider_id TEXT UNIQUE, direction TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text',
 body TEXT NOT NULL, delivery TEXT NOT NULL, created_at TEXT NOT NULL, author TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS whatsapp_message_history ON whatsapp_messages(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS whatsapp_audit (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES whatsapp_conversations(id),
 actor TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL
);
