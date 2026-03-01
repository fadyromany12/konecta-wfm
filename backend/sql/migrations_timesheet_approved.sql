-- Timesheet approval (lock) for payroll: when true, no edits allowed for that record/date
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS timesheet_approved BOOLEAN NOT NULL DEFAULT false;
