-- Break config per project, schedule breaks & activities, RTA role, 24h grid support
-- Run after migrations_projects_hierarchy.sql

-- Break configuration per project (PM/admin set: e.g. first break 15 min, lunch 30 min, last break 15 min)
CREATE TABLE IF NOT EXISTS project_break_config (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  break_label VARCHAR(80) NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 120),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, break_label)
);
CREATE INDEX IF NOT EXISTS idx_project_break_config_project ON project_break_config(project_id);

-- Add project_id and break slots to schedules (shift_start/end can be any time, same or next day)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS break_1_start TIMESTAMPTZ;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS break_1_end TIMESTAMPTZ;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS break_2_start TIMESTAMPTZ;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS break_2_end TIMESTAMPTZ;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS break_3_start TIMESTAMPTZ;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS break_3_end TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_schedules_project_date ON schedules(project_id, date) WHERE project_id IS NOT NULL;

-- Schedule activities: coachings and meetings (prescheduled or planned); managers can submit
CREATE TABLE IF NOT EXISTS schedule_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  type        VARCHAR(40) NOT NULL CHECK (type IN ('coaching', 'meeting', 'training')),
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  title       VARCHAR(200),
  notes       TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedule_activities_user_date ON schedule_activities(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_schedule_activities_project ON schedule_activities(project_id);

-- RTA role: manages schedules for all agents in one project at a time
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('agent', 'manager', 'admin', 'project_manager', 'rta'));

INSERT INTO roles (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000005', 'rta', 'RTA: manage schedules for agents in assigned project(s), set login/logout/breaks, add coachings/meetings')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (key, label, category) VALUES
  ('rta:schedule', 'Manage project schedules', 'RTA'),
  ('rta:activities', 'Add coachings/meetings', 'RTA'),
  ('rta:view_grid', 'View 24h activity grid', 'RTA'),
  ('break_config:manage', 'Manage project break config', 'Project'),
  ('grid:view', 'View 24h activity grid with violations', 'General')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000005', id FROM permissions WHERE key LIKE 'rta:%' OR key = 'grid:view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Which projects an RTA can manage (admin assigns)
CREATE TABLE IF NOT EXISTS rta_projects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_rta_projects_user ON rta_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_rta_projects_project ON rta_projects(project_id);

-- Project allowed aux types (for violation: unauthorized aux if not in list). Optional per project.
CREATE TABLE IF NOT EXISTS project_allowed_aux (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  aux_type   VARCHAR(50) NOT NULL,
  PRIMARY KEY (project_id, aux_type)
);
