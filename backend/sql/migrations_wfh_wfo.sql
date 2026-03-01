-- WFH / WFO for attendance (managers and agents). Run this so manager dashboard and clock-in can use Location.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_location VARCHAR(20) DEFAULT 'WFO';
