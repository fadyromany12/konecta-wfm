import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { asyncHandler, httpError } from "../../utils/asyncHandler";
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
import { getScheduleByUserAndDate } from "../schedules/repository";
import { insertException } from "../scheduleExceptions/repository";

const router = Router();

router.use(authenticateJWT);

const LEAVE_DAY_TYPES = ["annual", "sick", "casual", "overtime", "cancel_day_off", "leave"];

router.get("/me", requireRole(["agent", "manager", "admin"]), asyncHandler(async (req: AuthRequest, res) => {
  const list = await getShiftSwapsByUser(req.user!.sub);
  res.json(list);
}));

router.post("/", requireRole(["agent"]), asyncHandler(async (req: AuthRequest, res) => {
  const { target_id, date, reason } = req.body as { target_id?: string; date?: string; reason?: string };
  if (!target_id || !date) throw httpError("target_id and date are required", 400);
  if (target_id === req.user!.sub) throw httpError("Cannot swap with yourself", 400);
  const swap = await createShiftSwap(req.user!.sub, target_id, date, reason ?? null);
  res.status(201).json(swap);
}));

router.post("/:id/respond", requireRole(["agent"]), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { accept } = req.body as { accept?: boolean };
  const ok = await setTargetResponse(id, req.user!.sub, accept === true);
  if (!ok) throw httpError("Shift swap not found or already responded", 404);
  res.json({ message: accept ? "Accepted" : "Declined" });
}));

router.get("/manager/pending", requireRole(["manager"]), asyncHandler(async (req: AuthRequest, res) => {
  const list = await getPendingShiftSwapsForManager(req.user!.sub);
  res.json(list);
}));

router.get("/manager/team", requireRole(["manager"]), asyncHandler(async (req: AuthRequest, res) => {
  const list = await getShiftSwapsForManager(req.user!.sub);
  res.json(list);
}));

router.post("/:id/manager-approve", requireRole(["manager"]), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { approve } = req.body as { approve?: boolean };
  if (approve === true) {
    const swap = await getShiftSwapById(id);
    if (swap) {
      const reqSchedule = await getScheduleByUserAndDate(swap.requester_id, swap.date);
      const tgtSchedule = await getScheduleByUserAndDate(swap.target_id, swap.date);
      if (reqSchedule && tgtSchedule) {
        if (LEAVE_DAY_TYPES.includes((reqSchedule.day_type || "").toLowerCase())) {
          throw httpError("Requester has leave on that day; swap cannot overwrite leave.", 400);
        }
        if (LEAVE_DAY_TYPES.includes((tgtSchedule.day_type || "").toLowerCase())) {
          throw httpError("Target has leave on that day; swap cannot overwrite leave.", 400);
        }
      }
    }
  }
  await runInTransaction(async (client) => {
    const ok = await setManagerApproval(id, req.user!.sub, approve === true, client);
    if (!ok) throw httpError("Not found or not in your team", 404);
    if (approve === true) {
      const swap = await getShiftSwapById(id, client);
      if (swap) {
        const reqSchedule = await getScheduleByUserAndDate(swap.requester_id, swap.date, client);
        const tgtSchedule = await getScheduleByUserAndDate(swap.target_id, swap.date, client);
        if (reqSchedule && tgtSchedule) {
          await insertException(
            {
              userId: swap.requester_id,
              date: swap.date,
              exceptionType: "swap",
              refId: id,
              shiftStart: tgtSchedule.shift_start,
              shiftEnd: tgtSchedule.shift_end,
            },
            client,
          );
          await insertException(
            {
              userId: swap.target_id,
              date: swap.date,
              exceptionType: "swap",
              refId: id,
              shiftStart: reqSchedule.shift_start,
              shiftEnd: reqSchedule.shift_end,
            },
            client,
          );
        }
      }
    }
  });
  res.json({ message: approve ? "Approved" : "Rejected" });
}));

export default router;
