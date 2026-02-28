import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { createLeave, getLeaveByUser } from "./repository";
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

router.get("/me", async (req: AuthRequest, res) => {
  try {
    const list = await getLeaveByUser(req.user!.sub);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to fetch leave" } });
  }
});

router.post("/", requireRole(["agent"]), async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { type, start_date, end_date, start_time, end_time, reason, file_url } = parsed.data;
  if (type === "sick" && !file_url) {
    return res.status(400).json({ error: { message: "Sick leave requires a file upload" } });
  }
  if (type === "overtime" && (!start_time || !end_time)) {
    return res.status(400).json({ error: { message: "Overtime request requires start time and end time" } });
  }
  try {
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
    return res.status(201).json(leave);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to create leave" } });
  }
});

export default router;
