import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import {
  createShiftSwap,
  getShiftSwapsByUser,
  setTargetResponse,
  setManagerApproval,
  getPendingShiftSwapsForManager,
} from "./repository";

const router = Router();

router.use(authenticateJWT);

router.get("/me", requireRole(["agent", "manager", "admin"]), async (req: AuthRequest, res) => {
  try {
    const list = await getShiftSwapsByUser(req.user!.sub);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to fetch shift swaps" } });
  }
});

router.post("/", requireRole(["agent"]), async (req: AuthRequest, res) => {
  const { target_id, date, reason } = req.body as { target_id?: string; date?: string; reason?: string };
  if (!target_id || !date) {
    return res.status(400).json({ error: { message: "target_id and date are required" } });
  }
  if (target_id === req.user!.sub) {
    return res.status(400).json({ error: { message: "Cannot swap with yourself" } });
  }
  try {
    const swap = await createShiftSwap(req.user!.sub, target_id, date, reason ?? null);
    return res.status(201).json(swap);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to create shift swap" } });
  }
});

router.post("/:id/respond", requireRole(["agent"]), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { accept } = req.body as { accept?: boolean };
  try {
    const ok = await setTargetResponse(id, req.user!.sub, accept === true);
    if (!ok) return res.status(404).json({ error: { message: "Shift swap not found or already responded" } });
    return res.json({ message: accept ? "Accepted" : "Declined" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to respond" } });
  }
});

router.get("/manager/pending", requireRole(["manager"]), async (req: AuthRequest, res) => {
  try {
    const list = await getPendingShiftSwapsForManager(req.user!.sub);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to fetch" } });
  }
});

router.post("/:id/manager-approve", requireRole(["manager"]), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { approve } = req.body as { approve?: boolean };
  try {
    const ok = await setManagerApproval(id, req.user!.sub, approve === true);
    if (!ok) return res.status(404).json({ error: { message: "Not found or not in your team" } });
    return res.json({ message: approve ? "Approved" : "Rejected" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
