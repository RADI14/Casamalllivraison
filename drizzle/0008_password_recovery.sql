CREATE TABLE app_password_recovery (
 email TEXT PRIMARY KEY REFERENCES members(email) ON UPDATE CASCADE ON DELETE CASCADE,
 requested_at TEXT NOT NULL
);
