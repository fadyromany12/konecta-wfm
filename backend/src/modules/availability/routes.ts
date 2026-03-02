import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";
import * as repo from "./repository";

const router = Router();

function canAccessUser(actorId: string, actorRole: string, targetUserId: string): Promise<boolean> {
  if (actorId === targetUserId) return Promise.resolve(true);
  if (actorRole === "admin") return Promise.resolve(true);
  if (actorRole === "manager") {
    return query<{ n: number }>("SELECT 1 AS n FROM users WHERE id = $1 AND manager_id = $2 LIMIT 1", [targetUserId, actorId])
      .then((r) => r.rows.length > 0);
  }
  return Promise.resolve(false);
}

router.get("/:userId", authenticateJWT, async (req: AuthRequest, res) => {
  const targetUserId = req.params.userId as string;
  const allowed = await canAccessUser(req.user!.sub, req.user!.role, targetUserId);
  if (!allowed) return res.status(403).json({ error: { message: "Not allowed to view this user's availability" } });
  try {
    const [windows, preferences] = await Promise.all([
      repo.getWindowsByUser(targetUserId),
      repo.getPreferencesByUser(targetUserId),
    ]);
    return res.json({ windows, preferences });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.put("/:userId", authenticateJWT, async (req: AuthRequest, res) => {
  const targetUserId = req.params.userId as string;
  const allowed = await canAccessUser(req.user!.sub, req.user!.role, targetUserId);
  if (!allowed) return res.status(403).json({ error: { message: "Not allowed to edit this user's availability" } });
  const { windows, preferences } = req.body as {
    windows?: { day_of_week: number; start_time: string; end_time: string }[];
    preferences?: { key: string; value: string | null }[];
  };
  try {
    const [w, p] = await Promise.all([
      windows ? repo.setWindows(targetUserId, windows) : repo.getWindowsByUser(targetUserId),
      preferences ? repo.setPreferences(targetUserId, preferences) : repo.getPreferencesByUser(targetUserId),
    ]);
    return res.json({ windows: w, preferences: p });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
