-- Open shifts for bidding: post shifts that agents can claim.
CREATE TABLE IF NOT EXISTS open_shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID REFERENCES departments(id),
  date         DATE NOT NULL,
  shift_start  TIMESTAMPTZ NOT NULL,
  shift_end    TIMESTAMPTZ NOT NULL,
  role_or_title VARCHAR(100),
  notes        TEXT,
  posted_by    UUID REFERENCES users(id),
  claimed_by   UUID REFERENCES users(id),
  status       VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_open_shifts_date_status ON open_shifts(date, status);
CREATE INDEX IF NOT EXISTS idx_open_shifts_claimed_by ON open_shifts(claimed_by);
