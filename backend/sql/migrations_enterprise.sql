-- Enterprise features: run after migrations_extra.sql

-- Attendance scoring (punctuality, break compliance, overtime, absence ratio)
CREATE TABLE IF NOT EXISTS attendance_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  punctuality_score NUMERIC(5,2) DEFAULT 100,
  break_compliance  NUMERIC(5,2) DEFAULT 100,
  overtime_score    NUMERIC(5,2) DEFAULT 0,
  absence_ratio     NUMERIC(5,2) DEFAULT 0,
  overall_score     NUMERIC(5,2) DEFAULT 100,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start, period_end)
);

-- Manager notes and disciplinary tracking
CREATE TABLE IF NOT EXISTS manager_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  manager_id  UUID NOT NULL REFERENCES users(id),
  note_type   VARCHAR(50) NOT NULL DEFAULT 'general',
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS disciplinary_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  manager_id   UUID NOT NULL REFERENCES users(id),
  action_type  VARCHAR(50) NOT NULL,
  description  TEXT,
  severity     VARCHAR(20) NOT NULL DEFAULT 'warning',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payroll export runs (metadata only; data comes from attendance/leave)
CREATE TABLE IF NOT EXISTS payroll_exports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System alerts (break exceeded, no clock-out, sick days, etc.)
CREATE TABLE IF NOT EXISTS system_alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  alert_type VARCHAR(80) NOT NULL,
  message    TEXT NOT NULL,
  resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Internal chat (agent <-> manager, admin announcements)
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  channel    VARCHAR(50) NOT NULL DEFAULT 'direct',
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_scores_user_period ON attendance_scores(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_manager_notes_user ON manager_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_user ON disciplinary_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_receiver ON chat_messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
