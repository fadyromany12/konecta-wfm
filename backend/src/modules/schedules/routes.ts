import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { scheduleQuerySchema } from "./schema";
import { getScheduleForUser } from "./service";

const router = Router();

router.use(authenticateJWT, requireRole(["agent", "manager", "admin", "project_manager", "rta"]));

router.get("/me", async (req: AuthRequest, res) => {
  const parsed = scheduleQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const msg = parsed.error.errors?.[0]?.message ?? "Validation failed";
    return res.status(400).json({ error: { message: msg } });
  }
  try {
    const list = await getScheduleForUser(req.user!.sub, parsed.data.from, parsed.data.to);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to fetch schedule" } });
  }
});

export default router;
