import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, created_at FROM departments ORDER BY name`,
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.use(authenticateJWT, requireRole(["admin"]));

router.post("/", async (req: AuthRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    return res.status(400).json({ error: { message: "name required" } });
  }
  try {
    const { rows } = await query(
      `INSERT INTO departments (name) VALUES ($1) RETURNING *`,
      [name.trim()],
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    return res.status(400).json({ error: { message: "name required" } });
  }
  const { rows } = await query(
    `UPDATE departments SET name = $2 WHERE id = $1 RETURNING *`,
    [req.params.id, name.trim()],
  );
  if (!rows.length) return res.status(404).json({ error: { message: "Not found" } });
  return res.json(rows[0]);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  await query(`UPDATE users SET department_id = NULL WHERE department_id = $1`, [req.params.id]);
  const { rowCount } = await query(`DELETE FROM departments WHERE id = $1`, [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: { message: "Not found" } });
  return res.json({ message: "Deleted" });
});

export default router;
