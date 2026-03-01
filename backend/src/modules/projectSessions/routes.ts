import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";
const router = Router();

// List projects (for agent: all active projects; for PM: my projects)
router.get("/projects", authenticateJWT, requireRole(["agent", "manager", "admin", "project_manager"]), async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(`SELECT id, name, description FROM projects ORDER BY name`);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Agent: my current project session today (if any)
router.get("/me", authenticateJWT, requireRole(["agent", "manager", "admin", "project_manager"]), async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await query(
      `SELECT ps.*, p.name AS project_name FROM project_sessions ps JOIN projects p ON p.id = ps.project_id
       WHERE ps.user_id = $1 AND ps.session_date = $2 ORDER BY ps.clock_in_at DESC`,
      [userId, date]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Agent: clock in to project. Only one active session per project at a time (cannot clock in again to same project until clocked out).
router.post("/clock-in", authenticateJWT, requireRole(["agent", "manager", "admin", "project_manager"]), async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) return res.status(400).json({ error: { message: "projectId required" } });
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  try {
    const { rows: activeSameProject } = await query(
      `SELECT id FROM project_sessions WHERE user_id = $1 AND project_id = $2 AND session_date = $3 AND clock_out_at IS NULL`,
      [userId, projectId, today]
    );
    if (activeSameProject.length > 0) {
      return res.status(400).json({ error: { message: "Already clocked in to this project. Clock out first to start a new session." } });
    }
    await query(
      `UPDATE project_sessions SET clock_out_at = now() WHERE user_id = $1 AND session_date = $2 AND clock_out_at IS NULL`,
      [userId, today]
    );
    const { rows } = await query(
      `INSERT INTO project_sessions (user_id, project_id) VALUES ($1, $2) RETURNING *`,
      [userId, projectId]
    );
    const { rows: proj } = await query(`SELECT name FROM projects WHERE id = $1`, [projectId]);
    return res.status(201).json({ ...rows[0], project_name: proj[0]?.name });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Agent: clock out from project
router.post("/clock-out", authenticateJWT, requireRole(["agent", "manager", "admin", "project_manager"]), async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await query(
      `UPDATE project_sessions SET clock_out_at = now() WHERE user_id = $1 AND session_date = $2 AND clock_out_at IS NULL RETURNING *`,
      [userId, today]
    );
    if (!rows.length) return res.status(400).json({ error: { message: "No active project session" } });
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Project manager: list my projects
router.get("/pm/projects", authenticateJWT, requireRole(["project_manager", "admin"]), async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  try {
    const { rows } = await query(
      `SELECT p.* FROM projects p JOIN project_managers pm ON pm.project_id = p.id WHERE pm.user_id = $1 ORDER BY p.name`,
      [userId]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Project manager: project overview (agents who have sessions in this project, recent sessions)
router.get("/pm/projects/:id/overview", authenticateJWT, requireRole(["project_manager", "admin"]), async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const projectId = req.params.id;
  const isAdmin = req.user!.role === "admin";
  try {
    if (!isAdmin) {
      const { rows: check } = await query(`SELECT 1 FROM project_managers WHERE user_id = $1 AND project_id = $2`, [userId, projectId]);
      if (!check.length) return res.status(403).json({ error: { message: "Not your project" } });
    }
    const { rows: project } = await query(`SELECT * FROM projects WHERE id = $1`, [projectId]);
    if (!project.length) return res.status(404).json({ error: { message: "Project not found" } });
    const { rows: sessions } = await query(
      `SELECT ps.*, u.first_name, u.last_name, u.email FROM project_sessions ps JOIN users u ON u.id = ps.user_id
       WHERE ps.project_id = $1 AND ps.session_date >= current_date - interval '7 days' ORDER BY ps.clock_in_at DESC LIMIT 100`,
      [projectId]
    );
    const { rows: agents } = await query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email FROM project_sessions ps JOIN users u ON u.id = ps.user_id WHERE ps.project_id = $1`,
      [projectId]
    );
    return res.json({ project: project[0], sessions, agents });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
