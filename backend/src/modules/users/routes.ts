import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();

router.use(authenticateJWT);

/** List agents (for shift-swap dropdown etc). Excludes current user. */
router.get("/agents", requireRole(["agent", "manager", "admin"]), async (req: AuthRequest, res) => {
  try {
    const { rows } = await query<{ id: string; first_name: string; last_name: string; email: string }>(
      `SELECT id, first_name, last_name, email FROM users WHERE role = 'agent' AND status = 'active' AND id != $1 ORDER BY first_name, last_name`,
      [req.user!.sub],
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to fetch agents" } });
  }
});

export default router;
