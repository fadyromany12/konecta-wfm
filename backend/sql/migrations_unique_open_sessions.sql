-- One open attendance per user (prevents double clock-in race)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_one_open_per_user
  ON attendance (user_id) WHERE clock_out IS NULL;

-- One open AUX per user (prevents double start-break race)
CREATE UNIQUE INDEX IF NOT EXISTS idx_auxlogs_one_open_per_user
  ON auxlogs (user_id) WHERE end_time IS NULL;
