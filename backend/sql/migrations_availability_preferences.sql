-- Availability windows: recurring weekly windows when a user is available to work.
CREATE TABLE IF NOT EXISTS availability_windows (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL CHECK (end_time > start_time),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_availability_windows_user ON availability_windows(user_id);

-- Shift preferences: e.g. prefer_morning, max_days_per_week, prefer_no_weekend.
CREATE TABLE IF NOT EXISTS shift_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key         VARCHAR(80) NOT NULL,
  value       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_shift_preferences_user ON shift_preferences(user_id);
