-- Projects, project managers, project sessions, reporting line change, hierarchy
-- Run after migrations_approval_roles.sql

-- Projects (created by admin)
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project managers: user is PM for a project (full access to that project)
CREATE TABLE IF NOT EXISTS project_managers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);

-- Agent logs into one project at a time (session per day)
CREATE TABLE IF NOT EXISTS project_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  clock_in_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out_at TIMESTAMPTZ,
  session_date DATE GENERATED ALWAYS AS ((clock_in_at AT TIME ZONE 'UTC')::date) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_sessions_user_date ON project_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_project_sessions_project ON project_sessions(project_id);

-- Reporting line change: manager requests to transfer agent to another manager; approver = manager's manager (or admin)
CREATE TABLE IF NOT EXISTS reporting_line_change_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES users(id),
  from_manager_id UUID NOT NULL REFERENCES users(id),
  to_manager_id   UUID NOT NULL REFERENCES users(id),
  requested_by    UUID NOT NULL REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON reporting_line_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_approver ON reporting_line_change_requests(approved_by);

-- Allow project_manager in users.role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('agent', 'manager', 'admin', 'project_manager'));

-- Add project_manager role
INSERT INTO roles (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000004', 'project_manager', 'Project Manager: full access within assigned project(s)')
ON CONFLICT (name) DO NOTHING;

-- Permissions for project manager
INSERT INTO permissions (key, label, category) VALUES
  ('project:view', 'View project', 'Project'),
  ('project:session', 'Log in/out of project', 'Project'),
  ('project_manager:dashboard', 'Project dashboard', 'Project'),
  ('project_manager:team', 'View project team', 'Project')
ON CONFLICT (key) DO NOTHING;

-- Assign project permissions to project_manager role
INSERT INTO role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000004', id FROM permissions WHERE key LIKE 'project%'
ON CONFLICT DO NOTHING;
