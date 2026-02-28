import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, date, name, is_public, created_at FROM holidays ORDER BY date`,
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.use(authenticateJWT, requireRole(["admin"]));

router.post("/", async (req: AuthRequest, res) => {
  const { date, name, is_public } = req.body as { date?: string; name?: string; is_public?: boolean };
  if (!date || !name) {
    return res.status(400).json({ error: { message: "date and name required" } });
  }
  try {
    const { rows } = await query(
      `INSERT INTO holidays (date, name, is_public) VALUES ($1, $2, $3) ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name, is_public = EXCLUDED.is_public RETURNING *`,
      [date, name, is_public !== false],
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { date, name, is_public } = req.body as { date?: string; name?: string; is_public?: boolean };
  try {
    const { rows } = await query(
      `UPDATE holidays SET date = COALESCE($2, date), name = COALESCE($3, name), is_public = COALESCE($4, is_public) WHERE id = $1 RETURNING *`,
      [id, date ?? null, name ?? null, is_public ?? null],
    );
    if (!rows.length) return res.status(404).json({ error: { message: "Not found" } });
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const { rowCount } = await query(`DELETE FROM holidays WHERE id = $1`, [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: { message: "Not found" } });
  return res.json({ message: "Deleted" });
});

export default router;
