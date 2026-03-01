import { Router } from "express";
import { authenticateJWT, AuthRequest } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();
router.use(authenticateJWT);

/** Org view: 3 managers above me + my colleagues (same direct manager). */
router.get("/org-view", async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  try {
    const { rows: me } = await query(
      "SELECT id, first_name, last_name, email, role, manager_id FROM users WHERE id = $1",
      [userId]
    );
    if (!me.length) return res.status(404).json({ error: { message: "User not found" } });
    const managersAbove: { id: string; first_name: string; last_name: string; email: string; role: string; level: number }[] = [];
    let currentManagerId: string | null = me[0].manager_id;
    for (let level = 1; level <= 3 && currentManagerId; level++) {
      const { rows: m } = await query(
        "SELECT id, first_name, last_name, email, role, manager_id FROM users WHERE id = $1",
        [currentManagerId]
      );
      if (!m.length) break;
      managersAbove.push({ ...m[0], level });
      currentManagerId = m[0].manager_id;
    }
    const { rows: colleagues } = await query(
      `SELECT id, first_name, last_name, email, role FROM users WHERE manager_id = $1 AND id != $2 AND status = 'active' ORDER BY first_name, last_name`,
      [me[0].manager_id, userId]
    );
    return res.json({
      me: me[0],
      managersAbove,
      colleagues,
    });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
