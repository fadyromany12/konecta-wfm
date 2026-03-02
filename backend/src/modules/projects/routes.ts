import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();

router.get("/", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(
      "SELECT p.id, p.name, p.description, p.created_at, p.created_by, (SELECT count(*)::int FROM project_managers pm WHERE pm.project_id = p.id) AS pm_count FROM projects p ORDER BY p.name"
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) return res.status(400).json({ error: { message: "name required" } });
  try {
    const { rows } = await query(
      "INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING *",
      [name.trim(), description?.trim() || null, req.user!.sub]
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.put("/:id", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, description } = req.body as { name?: string; description?: string };
  try {
    await query(
      "UPDATE projects SET name = COALESCE($2, name), description = $3 WHERE id = $1",
      [id, name?.trim(), description !== undefined ? description : null]
    );
    const { rows } = await query("SELECT * FROM projects WHERE id = $1", [id]);
    return res.json(rows[0] || {});
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.delete("/:id", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    const { rowCount } = await query("DELETE FROM projects WHERE id = $1", [req.params.id]);
    if ((rowCount ?? 0) === 0) return res.status(404).json({ error: { message: "Not found" } });
    return res.json({ message: "Deleted" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/:id/managers", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(
      "SELECT pm.*, u.first_name, u.last_name, u.email FROM project_managers pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = $1",
      [req.params.id]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/:id/managers", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ error: { message: "userId required" } });
  try {
    await query(
      "INSERT INTO project_managers (user_id, project_id) VALUES ($1, $2) ON CONFLICT (user_id, project_id) DO NOTHING",
      [userId, req.params.id]
    );
    const { rows } = await query(
      "SELECT pm.*, u.first_name, u.last_name FROM project_managers pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = $1 AND pm.user_id = $2",
      [req.params.id, userId]
    );
    return res.status(201).json(rows[0] || { user_id: userId, project_id: req.params.id });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.delete("/:id/managers/:userId", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    await query("DELETE FROM project_managers WHERE project_id = $1 AND user_id = $2", [req.params.id, req.params.userId]);
    return res.json({ message: "Removed" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Admin: RTA assignment for project
router.get("/:id/rta", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(
      "SELECT rp.*, u.first_name, u.last_name, u.email FROM rta_projects rp JOIN users u ON u.id = rp.user_id WHERE rp.project_id = $1",
      [req.params.id]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/:id/rta", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ error: { message: "userId required" } });
  try {
    await query(
      "INSERT INTO rta_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT (user_id, project_id) DO NOTHING",
      [userId, req.params.id]
    );
    const { rows } = await query(
      "SELECT rp.*, u.first_name, u.last_name FROM rta_projects rp JOIN users u ON u.id = rp.user_id WHERE rp.project_id = $1 AND rp.user_id = $2",
      [req.params.id, userId]
    );
    return res.status(201).json(rows[0] || { user_id: userId, project_id: req.params.id });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.delete("/:id/rta/:userId", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    await query("DELETE FROM rta_projects WHERE project_id = $1 AND user_id = $2", [req.params.id, req.params.userId]);
    return res.json({ message: "Removed" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
