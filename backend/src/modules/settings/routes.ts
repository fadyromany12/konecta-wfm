import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { getAllSettings } from "./repository";
import { setAppTimezone } from "./service";

const router = Router();

router.use(authenticateJWT);

/** Get app settings (e.g. timezone). Admin only for full list; allow authenticated read of timezone for frontend. */
router.get("/", requireRole(["admin", "manager", "rta", "agent"]), asyncHandler(async (req: AuthRequest, res) => {
  const settings = await getAllSettings();
  res.json(settings);
}));

router.patch("/", requireRole(["admin"]), asyncHandler(async (req: AuthRequest, res) => {
  const { timezone } = req.body as { timezone?: string };
  if (timezone !== undefined) await setAppTimezone(timezone);
  const settings = await getAllSettings();
  res.json(settings);
}));

export default router;
