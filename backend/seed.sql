-- Konecta WFM - Seed users (run after schema.sql)
-- Password for ALL users below: Password1

-- Admin
INSERT INTO users (first_name, last_name, email, password_hash, role, status, is_approved, is_email_verified)
VALUES (
  'Admin',
  'User',
  'admin@konecta.com',
  '$2b$10$h13oSdMDbNmSjU6IjyvvGOoXe2fOnzL7snRbZSywGg3wofd/MzNFK',
  'admin',
  'active',
  true,
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  status = 'active',
  is_approved = true,
  is_email_verified = true;

-- Manager
INSERT INTO users (first_name, last_name, email, password_hash, role, status, is_approved, is_email_verified)
VALUES (
  'Manager',
  'User',
  'manager@konecta.com',
  '$2b$10$h13oSdMDbNmSjU6IjyvvGOoXe2fOnzL7snRbZSywGg3wofd/MzNFK',
  'manager',
  'active',
  true,
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  status = 'active',
  is_approved = true,
  is_email_verified = true;

-- Agent (reports to manager)
INSERT INTO users (first_name, last_name, email, password_hash, role, manager_id, status, is_approved, is_email_verified)
SELECT
  'Test',
  'Agent',
  'test.agent@konecta.com',
  '$2b$10$h13oSdMDbNmSjU6IjyvvGOoXe2fOnzL7snRbZSywGg3wofd/MzNFK',
  'agent',
  u.id,
  'active',
  true,
  true
FROM users u WHERE u.email = 'manager@konecta.com' LIMIT 1
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  manager_id = (SELECT id FROM users WHERE email = 'manager@konecta.com' LIMIT 1),
  status = 'active',
  is_approved = true,
  is_email_verified = true;
