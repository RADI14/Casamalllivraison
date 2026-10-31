ALTER TABLE whatsapp_conversations ADD COLUMN assigned_email TEXT;
UPDATE whatsapp_conversations SET assigned_email=(SELECT created_email FROM orders WHERE orders.id=whatsapp_conversations.order_id);
CREATE INDEX whatsapp_assignment ON whatsapp_conversations(assigned_email,updated_at);
