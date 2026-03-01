-- Global app settings (e.g. timezone for "today" and date boundaries)
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_settings (key, value) VALUES ('timezone', 'UTC')
ON CONFLICT (key) DO NOTHING;
