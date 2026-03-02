import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import * as repo from "./repository";
import * as svc from "./service";

const router = Router();

router.get("/", authenticateJWT, requireRole(["admin", "manager"]), async (_req, res) => {
  try {
    const rules = await repo.getAll();
    return res.json(rules);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.put("/:key", authenticateJWT, requireRole(["admin"]), async (req: AuthRequest, res) => {
  const key = req.params.key as string;
  const { value_num, value_text } = req.body as { value_num?: number; value_text?: string };
  try {
    const rule = await repo.setRule(key, value_num ?? null, value_text ?? null);
    return res.json(rule);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/validate", authenticateJWT, requireRole(["admin", "manager"]), async (req: AuthRequest, res) => {
  const { user_id, date, shift_start, shift_end, exclude_schedule_id } = req.body as {
    user_id?: string;
    date?: string;
    shift_start?: string;
    shift_end?: string;
    exclude_schedule_id?: string;
  };
  if (!user_id || !date || !shift_start || !shift_end)
    return res.status(400).json({ error: { message: "user_id, date, shift_start, shift_end required" } });
  try {
    const result = await svc.validateShiftForUser(user_id, date, shift_start, shift_end, exclude_schedule_id);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
