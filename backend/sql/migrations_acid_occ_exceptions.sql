-- ACID, OCC, and schedule exceptions migration.
-- Run after migrations_breaks_rta_grid.sql (schedules has project_id, break_* columns).
-- Enables: version on schedules (OCC), status on attendance (ANOMALY), schedule_exceptions,
-- temporal exclusion on schedules, v_effective_schedules view.

-- 1. Attendance: status for ACTIVE vs ANOMALY (forgot to clock out > 16h)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
UPDATE attendance SET status = 'ACTIVE' WHERE status IS NULL OR status = '';
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('ACTIVE', 'ANOMALY'));

-- 2. Schedules: OCC version column
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
UPDATE schedules SET version = 1 WHERE version IS NULL;

-- 3. Drop UNIQUE(user_id, date) and add temporal exclusion (no overlapping shifts per user)
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_user_id_date_key;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_no_overlap_tstzrange;
ALTER TABLE schedules ADD CONSTRAINT schedules_no_overlap_tstzrange
  EXCLUDE USING gist (user_id WITH =, tstzrange(shift_start, shift_end) WITH &&)
  WHERE (shift_start IS NOT NULL AND shift_end IS NOT NULL);

-- 4. Schedule exceptions (leave/swap overlay; do not mutate base schedules)
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  exception_type  VARCHAR(20) NOT NULL CHECK (exception_type IN ('leave', 'swap')),
  ref_id          UUID NOT NULL,
  shift_start     TIMESTAMPTZ,
  shift_end       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_user_date ON schedule_exceptions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_ref ON schedule_exceptions(ref_id);

-- 5. View: effective schedule per (user_id, date). Exception overrides base when present. Includes break columns (null for exceptions).
DROP VIEW IF EXISTS v_effective_schedules;
CREATE VIEW v_effective_schedules AS
SELECT DISTINCT ON (user_id, date)
  user_id,
  date,
  shift_start,
  shift_end,
  day_type,
  source,
  ref_id,
  break_1_start,
  break_1_end,
  break_2_start,
  break_2_end,
  break_3_start,
  break_3_end
FROM (
  SELECT user_id, date, shift_start, shift_end, day_type, 'base'::VARCHAR(20) AS source, NULL::UUID AS ref_id, 1 AS sort_order,
    break_1_start, break_1_end, break_2_start, break_2_end, break_3_start, break_3_end
  FROM schedules
  UNION ALL
  SELECT user_id, date, shift_start, shift_end, exception_type AS day_type, exception_type AS source, ref_id, 0 AS sort_order,
    NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ
  FROM schedule_exceptions
) u
ORDER BY user_id, date, sort_order;
