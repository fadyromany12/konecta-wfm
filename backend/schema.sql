-- Konecta WFM - Full schema (run this first)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  email             VARCHAR(255) UNIQUE NOT NULL CHECK (email LIKE '%@konecta.com'),
  password_hash     TEXT NOT NULL,
  role              VARCHAR(20) NOT NULL CHECK (role IN ('agent', 'manager', 'admin')),
  manager_id        UUID REFERENCES users(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','inactive')),
  is_approved       BOOLEAN NOT NULL DEFAULT FALSE,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  clock_in          TIMESTAMPTZ NOT NULL,
  clock_out         TIMESTAMPTZ,
  total_hours       INTERVAL,
  is_late           BOOLEAN DEFAULT FALSE,
  is_early_logout   BOOLEAN DEFAULT FALSE,
  overtime_duration INTERVAL DEFAULT '0 hours',
  shift_date        DATE GENERATED ALWAYS AS ((clock_in AT TIME ZONE 'UTC')::date) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auxlogs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  aux_type    VARCHAR(50) NOT NULL,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ,
  duration    INTERVAL,
  over_limit  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  date         DATE NOT NULL,
  shift_start  TIMESTAMPTZ,
  shift_end    TIMESTAMPTZ,
  day_type     VARCHAR(20) NOT NULL,
  is_overtime_allowed BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  type          VARCHAR(30) NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  start_time    TIME,
  end_time      TIME,
  reason        TEXT,
  file_url      TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_swaps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id     UUID NOT NULL REFERENCES users(id),
  target_id        UUID NOT NULL REFERENCES users(id),
  date             DATE NOT NULL,
  reason           TEXT,
  requester_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  manager_approval VARCHAR(20) NOT NULL DEFAULT 'pending',
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  message      TEXT NOT NULL,
  type         VARCHAR(50),
  read_status  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action    TEXT NOT NULL,
  user_id   UUID REFERENCES users(id),
  metadata  JSONB,
  ip        INET,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_shift_date ON attendance(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_auxlogs_user_start_time ON auxlogs(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_status ON leave_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_status ON notifications(user_id, read_status);
