-- Timezone per department/location for "today" and midnight rollover.
ALTER TABLE departments ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'UTC';
COMMENT ON COLUMN departments.timezone IS 'IANA timezone (e.g. America/New_York) for shift date and midnight rollover';
