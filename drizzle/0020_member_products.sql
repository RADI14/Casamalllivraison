CREATE TABLE member_products(member_email TEXT NOT NULL REFERENCES members(email) ON UPDATE CASCADE ON DELETE CASCADE,stock_id TEXT NOT NULL,PRIMARY KEY(member_email,stock_id));
