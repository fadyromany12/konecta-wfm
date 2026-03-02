import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import * as repo from "./repository";

const router = Router();

router.get("/open", authenticateJWT, async (req, res) => {
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const to = (req.query.to as string) || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const rows = await repo.listOpen(from, to);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/my-claims", authenticateJWT, async (req: AuthRequest, res) => {
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const to = (req.query.to as string) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const rows = await repo.listMyClaims(req.user!.sub, from, to);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/open/:id/claim", authenticateJWT, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  try {
    const row = await repo.claim(id, req.user!.sub);
    if (!row) return res.status(404).json({ error: { message: "Shift not found or already claimed" } });
    return res.json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.use(authenticateJWT, requireRole(["admin", "manager"]));

router.post("/post", async (req: AuthRequest, res) => {
  const { location_id, date, shift_start, shift_end, role_or_title, notes } = req.body as {
    location_id?: string;
    date?: string;
    shift_start?: string;
    shift_end?: string;
    role_or_title?: string;
    notes?: string;
  };
  if (!date || !shift_start || !shift_end) {
    return res.status(400).json({ error: { message: "date, shift_start, shift_end required" } });
  }
  try {
    const row = await repo.create({
      location_id: location_id || null,
      date,
      shift_start,
      shift_end,
      role_or_title: role_or_title || null,
      notes: notes || null,
      posted_by: req.user!.sub,
    });
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/open/:id/cancel", async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  try {
    const ok = await repo.cancel(id);
    if (!ok) return res.status(404).json({ error: { message: "Not found" } });
    return res.json({ message: "Cancelled" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
