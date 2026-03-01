-- Leave balances per user per year (annual, sick). Admin can set initial/accrued; deducted on approval.
CREATE TABLE IF NOT EXISTS leave_balances (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year       INT NOT NULL,
  leave_type VARCHAR(30) NOT NULL,
  balance    NUMERIC(10,2) NOT NULL DEFAULT 0,
  used       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON leave_balances(user_id, year);
