import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { getScheduleByUser } from "./repository";

const router = Router();

router.use(authenticateJWT, requireRole(["agent", "manager", "admin"]));

router.get("/me", async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) {
    return res.status(400).json({ error: { message: "Query params from and to (YYYY-MM-DD) required" } });
  }
  try {
    const list = await getScheduleByUser(req.user!.sub, from, to);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to fetch schedule" } });
  }
});

export default router;
