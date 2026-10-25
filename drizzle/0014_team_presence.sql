CREATE TABLE team_presence (
 session_hash TEXT PRIMARY KEY NOT NULL,
 email TEXT NOT NULL,
 started_at INTEGER NOT NULL,
 last_seen INTEGER NOT NULL
);
CREATE INDEX team_presence_email ON team_presence(email);
