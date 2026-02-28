import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { clockIn, clockOut, getMyAttendanceHistory } from "./service";

const router = Router();

router.use(authenticateJWT, requireRole(["agent", "manager", "admin"]));

router.post("/clock-in", async (req: AuthRequest, res) => {
  try {
    const attendance = await clockIn(req.user!.sub);
    return res.status(201).json(attendance);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Clock in failed" } });
  }
});

router.post("/clock-out", async (req: AuthRequest, res) => {
  try {
    const attendance = await clockOut(req.user!.sub);
    return res.json(attendance);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Clock out failed" } });
  }
});

router.get("/me", async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  try {
    const history = await getMyAttendanceHistory(req.user!.sub, from, to);
    return res.json(history);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch failed" } });
  }
});

export default router;

