-- Approval flow (manager select, temp password), password reset request, roles & permissions
-- Run after migrations_enterprise.sql

-- Allow login before email verify when using approval flow; track if user must change temp password
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT false;

-- Password reset requests (no email: manager/admin sets temp password from dashboard)
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_at  TIMESTAMPTZ,
  handled_by  UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_handled ON password_reset_requests(handled_at);

-- Roles (built-in + admin-created) and permissions
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(80) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key   VARCHAR(120) UNIQUE NOT NULL,
  label VARCHAR(200) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'general'
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);
-- Allow custom role names (from roles table)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(80);

-- Seed built-in roles
INSERT INTO roles (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'agent', 'Agent: attendance, leave, schedule, swap'),
  ('00000000-0000-0000-0000-000000000002', 'manager', 'Manager: team, approvals, wallboard'),
  ('00000000-0000-0000-0000-000000000003', 'admin', 'Admin: full access')
ON CONFLICT (name) DO NOTHING;

-- Seed permissions (app functions)
INSERT INTO permissions (key, label, category) VALUES
  ('attendance:clock', 'Clock in/out', 'Agent'),
  ('attendance:view', 'View my attendance', 'Agent'),
  ('aux:use', 'Use AUX (break, lunch)', 'Agent'),
  ('leave:request', 'Request leave', 'Agent'),
  ('schedule:view', 'View my schedule', 'Agent'),
  ('swap:request', 'Request shift swap', 'Agent'),
  ('profile:view', 'View profile', 'General'),
  ('profile:change_password', 'Change password', 'General'),
  ('manager:team', 'View team', 'Manager'),
  ('manager:wallboard', 'Wallboard', 'Manager'),
  ('manager:approvals', 'Approve leave & swaps', 'Manager'),
  ('manager:schedule', 'Team schedule', 'Manager'),
  ('manager:notes', 'Manager notes', 'Manager'),
  ('admin:users', 'Manage users', 'Admin'),
  ('admin:roles', 'Manage roles & permissions', 'Admin'),
  ('admin:reports', 'Reports & exports', 'Admin'),
  ('admin:schedule', 'Schedule management', 'Admin'),
  ('admin:audit', 'Audit logs', 'Admin'),
  ('admin:settings', 'Settings', 'Admin')
ON CONFLICT (key) DO NOTHING;

-- Assign all permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
ON CONFLICT DO NOTHING;

-- Assign manager permissions
INSERT INTO role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
  WHERE key LIKE 'manager:%' OR key LIKE 'profile:%' OR key IN ('attendance:view', 'schedule:view')
ON CONFLICT DO NOTHING;

-- Assign agent permissions
INSERT INTO role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions
  WHERE key LIKE 'attendance:%' OR key LIKE 'aux:%' OR key LIKE 'leave:%' OR key LIKE 'schedule:%' OR key LIKE 'swap:%' OR key LIKE 'profile:%'
ON CONFLICT DO NOTHING;

-- Backfill role_id from users.role (match by name)
UPDATE users u SET role_id = r.id FROM roles r WHERE r.name = u.role AND u.role_id IS NULL;
