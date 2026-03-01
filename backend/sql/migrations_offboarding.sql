-- Agent offboarding with reason
ALTER TABLE users ADD COLUMN IF NOT EXISTS offboarded_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS offboarding_reason TEXT;
