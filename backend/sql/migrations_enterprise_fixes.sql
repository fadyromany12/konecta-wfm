-- Phase 1: Database Schema & Integrity Locks
-- Temporal overlaps, OCC prep, base schedule protection.
-- Run after schedules table exists (e.g. migrations_breaks_rta_grid.sql).

-- 1. Schedules: OCC version
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
UPDATE schedules SET version = 1 WHERE version IS NULL;

-- 2. btree_gist for exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 3. Replace UNIQUE (user_id, date) with temporal exclusion (no overlapping shifts per user)
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_user_id_date_key;
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_no_overlap_tstzrange;
ALTER TABLE schedules ADD CONSTRAINT schedules_no_overlap_tstzrange
  EXCLUDE USING gist (user_id WITH =, tstzrange(shift_start, shift_end) WITH &&)
  WHERE (shift_start IS NOT NULL AND shift_end IS NOT NULL);

-- 4. Schedule exceptions (leave/swap; do not mutate base schedules)
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

-- 5. Attendance: status (ACTIVE / ANOMALY)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
UPDATE attendance SET status = 'ACTIVE' WHERE status IS NULL OR status = '';
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('ACTIVE', 'ANOMALY'));
