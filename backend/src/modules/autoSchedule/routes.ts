import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import * as svc from "./service";

const router = Router();
router.use(authenticateJWT, requireRole(["admin", "manager", "rta"]));

router.post("/suggest", async (req: AuthRequest, res) => {
  const { from, to, user_ids } = req.body as { from?: string; to?: string; user_ids?: string[] };
  if (!from || !to) return res.status(400).json({ error: { message: "from and to (YYYY-MM-DD) required" } });
  try {
    const result = await svc.suggestShifts(from, to, user_ids);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
