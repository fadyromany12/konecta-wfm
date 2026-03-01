import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { runInTransaction } from "../../db/pool";
import {
  createShiftSwap,
  getShiftSwapsByUser,
  setTargetResponse,
  setManagerApproval,
  getPendingShiftSwapsForManager,
  getShiftSwapsForManager,
  getShiftSwapById,
} from "./repository";
import { getScheduleByUserAndDate, upsertSchedule } from "../schedules/repository";

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

router.get("/manager/team", requireRole(["manager"]), async (req: AuthRequest, res) => {
  try {
    const list = await getShiftSwapsForManager(req.user!.sub);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to fetch" } });
  }
});

const LEAVE_DAY_TYPES = ["annual", "sick", "casual", "overtime", "cancel_day_off", "leave"];

router.post("/:id/manager-approve", requireRole(["manager"]), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { approve } = req.body as { approve?: boolean };
  try {
    if (approve === true) {
      const swap = await getShiftSwapById(id);
      if (swap) {
        const reqSchedule = await getScheduleByUserAndDate(swap.requester_id, swap.date);
        const tgtSchedule = await getScheduleByUserAndDate(swap.target_id, swap.date);
        if (reqSchedule && tgtSchedule) {
          if (LEAVE_DAY_TYPES.includes((reqSchedule.day_type || "").toLowerCase())) {
            return res.status(400).json({
              error: { message: "Requester has leave on that day; swap cannot overwrite leave." },
            });
          }
          if (LEAVE_DAY_TYPES.includes((tgtSchedule.day_type || "").toLowerCase())) {
            return res.status(400).json({
              error: { message: "Target has leave on that day; swap cannot overwrite leave." },
            });
          }
        }
      }
    }
    await runInTransaction(async (client) => {
      const ok = await setManagerApproval(id, req.user!.sub, approve === true, client);
      if (!ok) throw new Error("Not found or not in your team");
      if (approve === true) {
        const swap = await getShiftSwapById(id, client);
        if (swap) {
          const reqSchedule = await getScheduleByUserAndDate(swap.requester_id, swap.date, client);
          const tgtSchedule = await getScheduleByUserAndDate(swap.target_id, swap.date, client);
          if (reqSchedule && tgtSchedule) {
            await upsertSchedule(
              {
                userId: swap.requester_id,
                date: swap.date,
                projectId: tgtSchedule.project_id,
                shiftStart: tgtSchedule.shift_start,
                shiftEnd: tgtSchedule.shift_end,
                break1Start: tgtSchedule.break_1_start,
                break1End: tgtSchedule.break_1_end,
                break2Start: tgtSchedule.break_2_start,
                break2End: tgtSchedule.break_2_end,
                break3Start: tgtSchedule.break_3_start,
                break3End: tgtSchedule.break_3_end,
                dayType: tgtSchedule.day_type,
              },
              client,
            );
            await upsertSchedule(
              {
                userId: swap.target_id,
                date: swap.date,
                projectId: reqSchedule.project_id,
                shiftStart: reqSchedule.shift_start,
                shiftEnd: reqSchedule.shift_end,
                break1Start: reqSchedule.break_1_start,
                break1End: reqSchedule.break_1_end,
                break2Start: reqSchedule.break_2_start,
                break2End: reqSchedule.break_2_end,
                break3Start: reqSchedule.break_3_start,
                break3End: reqSchedule.break_3_end,
                dayType: reqSchedule.day_type,
              },
              client,
            );
          }
        }
      }
    });
    return res.json({ message: approve ? "Approved" : "Rejected" });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("not found") ? 404 : 400;
    return res.status(status).json({ error: { message } });
  }
});

export default router;
