import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { asyncHandler, httpError } from "../../utils/asyncHandler";
import { createLeave, getLeaveByUser } from "./repository";
import { ensureBalance, getBalancesForUser, getAvailableDays } from "../leaveBalances/repository";
import { dateRangeArray } from "../../utils/dateHelpers";
import { z } from "zod";

const router = Router();
const createSchema = z.object({
  type: z.enum(["annual", "sick", "casual", "overtime", "cancel_day_off"]),
  start_date: z.string(),
  end_date: z.string(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  file_url: z.string().optional().nullable(),
});

router.use(authenticateJWT, requireRole(["agent", "manager", "admin"]));

router.get("/me", asyncHandler(async (req: AuthRequest, res) => {
  const list = await getLeaveByUser(req.user!.sub);
  res.json(list);
}));

router.get("/balances/me", asyncHandler(async (req: AuthRequest, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const rows = await getBalancesForUser(req.user!.sub, year);
  const withAvailable = await Promise.all(
    rows.map(async (r) => {
      const available = await getAvailableDays(r.user_id, r.year, r.leave_type);
      return { ...r, available: available ?? null };
    }),
  );
  res.json({ year, items: withAvailable });
}));

router.post("/", requireRole(["agent"]), asyncHandler(async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors?.[0]?.message ?? "Validation failed";
    throw httpError(msg, 400);
  }
  const { type, start_date, end_date, start_time, end_time, reason, file_url } = parsed.data;
  if (type === "sick" && !file_url) {
    throw httpError("Sick leave requires a file upload", 400);
  }
  if (type === "overtime" && (!start_time || !end_time)) {
    throw httpError("Overtime request requires start time and end time", 400);
  }
  if ((type === "annual" || type === "sick") && start_date && end_date) {
    const year = new Date(start_date).getFullYear();
    const days = dateRangeArray(start_date, end_date).length;
    try {
      await ensureBalance(req.user!.sub, year, type, days);
    } catch (e) {
      throw httpError(e instanceof Error ? e.message : "Insufficient leave balance", 400);
    }
  }
  const leave = await createLeave({
    userId: req.user!.sub,
    type,
    startDate: start_date,
    endDate: end_date,
    startTime: start_time ?? undefined,
    endTime: end_time ?? undefined,
    reason: reason ?? undefined,
    fileUrl: file_url ?? undefined,
  });
  res.status(201).json(leave);
}));

export default router;
