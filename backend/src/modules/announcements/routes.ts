import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, title, body, visible_from, visible_to, created_at
       FROM announcements
       WHERE visible_from <= now() AND (visible_to IS NULL OR visible_to >= now())
       ORDER BY visible_from DESC`,
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.use(authenticateJWT, requireRole(["admin"]));

router.get("/all", async (_req, res) => {
  const { rows } = await query(
    `SELECT id, title, body, visible_from, visible_to, created_by, created_at FROM announcements ORDER BY created_at DESC`,
  );
  return res.json(rows);
});

router.post("/", async (req: AuthRequest, res) => {
  const { title, body, visible_from, visible_to } = req.body as {
    title?: string;
    body?: string;
    visible_from?: string;
    visible_to?: string;
  };
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: { message: "title and body required" } });
  }
  try {
    const { rows } = await query(
      `INSERT INTO announcements (title, body, visible_from, visible_to, created_by)
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5)
       RETURNING *`,
      [
        title.trim(),
        body.trim(),
        visible_from || new Date().toISOString(),
        visible_to || null,
        req.user!.sub,
      ],
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { title, body, visible_from, visible_to } = req.body as {
    title?: string;
    body?: string;
    visible_from?: string;
    visible_to?: string;
  };
  const { rows } = await query(
    `UPDATE announcements SET
       title = COALESCE($2, title),
       body = COALESCE($3, body),
       visible_from = COALESCE($4::timestamptz, visible_from),
       visible_to = CASE WHEN $5::text IS NULL THEN visible_to ELSE $5::timestamptz END
     WHERE id = $1 RETURNING *`,
    [id, title ?? null, body ?? null, visible_from ?? null, visible_to ?? null],
  );
  if (!rows.length) return res.status(404).json({ error: { message: "Not found" } });
  return res.json(rows[0]);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const { rowCount } = await query(`DELETE FROM announcements WHERE id = $1`, [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: { message: "Not found" } });
  return res.json({ message: "Deleted" });
});

export default router;
