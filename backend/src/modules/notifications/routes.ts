import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { getByUser, markRead, markAllRead } from "./repository";

const router = Router();
router.use(authenticateJWT, requireRole(["agent", "manager", "admin"]));

router.get("/", async (req: AuthRequest, res) => {
  const unreadOnly = req.query.unread === "true";
  const list = await getByUser(req.user!.sub, unreadOnly);
  return res.json(list);
});

router.patch("/:id/read", async (req: AuthRequest, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const ok = await markRead(id, req.user!.sub);
  if (!ok) return res.status(404).json({ error: { message: "Notification not found" } });
  return res.json({ message: "Marked as read" });
});

router.post("/read-all", async (req: AuthRequest, res) => {
  await markAllRead(req.user!.sub);
  return res.json({ message: "All marked as read" });
});

export default router;
