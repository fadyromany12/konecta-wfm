-- Labor rules: configurable limits (daily/weekly max hours, min rest between shifts, break limits).
CREATE TABLE IF NOT EXISTS labor_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(80) UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL,
  value_num   NUMERIC,
  value_text  TEXT,
  unit        VARCHAR(20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO labor_rules (key, name, value_num, unit) VALUES
  ('daily_max_hours', 'Max hours per day', 12, 'hours'),
  ('weekly_max_hours', 'Max hours per week', 48, 'hours'),
  ('min_rest_between_shifts_hours', 'Min rest between shifts', 11, 'hours'),
  ('max_consecutive_days', 'Max consecutive working days', 6, 'days'),
  ('min_break_duration_minutes', 'Min break duration', 30, 'minutes')
ON CONFLICT (key) DO NOTHING;
