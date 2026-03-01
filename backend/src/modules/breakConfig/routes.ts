import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();

// Get break config for a project (PM, admin, RTA)
router.get("/project/:projectId", authenticateJWT, requireRole(["admin", "project_manager", "rta"]), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const userId = req.user!.sub;
  const role = req.user!.role;
  try {
    if (role !== "admin") {
      const { rows: pm } = await query(
        "SELECT 1 FROM project_managers WHERE user_id = $1 AND project_id = $2",
        [userId, projectId]
      );
      const { rows: rta } = await query(
        "SELECT 1 FROM rta_projects WHERE user_id = $1 AND project_id = $2",
        [userId, projectId]
      );
      if (!pm.length && !rta.length) return res.status(403).json({ error: { message: "Not your project" } });
    }
    const { rows } = await query(
      "SELECT * FROM project_break_config WHERE project_id = $1 ORDER BY sort_order, break_label",
      [projectId]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Set break config for a project (PM or admin) - replace all configs for project
router.put("/project/:projectId", authenticateJWT, requireRole(["admin", "project_manager"]), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const userId = req.user!.sub;
  const role = req.user!.role;
  const configs = req.body as { break_label: string; duration_minutes: number; sort_order?: number }[];
  if (!Array.isArray(configs)) return res.status(400).json({ error: { message: "Body must be array of { break_label, duration_minutes, sort_order? }" } });
  try {
    if (role !== "admin") {
      const { rows } = await query("SELECT 1 FROM project_managers WHERE user_id = $1 AND project_id = $2", [userId, projectId]);
      if (!rows.length) return res.status(403).json({ error: { message: "Not your project" } });
    }
    await query("DELETE FROM project_break_config WHERE project_id = $1", [projectId]);
    for (let i = 0; i < configs.length; i++) {
      const c = configs[i];
      if (!c.break_label || !(c.duration_minutes >= 1 && c.duration_minutes <= 120)) continue;
      await query(
        "INSERT INTO project_break_config (project_id, break_label, duration_minutes, sort_order) VALUES ($1, $2, $3, $4)",
        [projectId, c.break_label, c.duration_minutes, c.sort_order ?? i]
      );
    }
    const { rows } = await query("SELECT * FROM project_break_config WHERE project_id = $1 ORDER BY sort_order, break_label", [projectId]);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
