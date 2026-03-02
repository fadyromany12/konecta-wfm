import { z } from "zod";

export const createLeaveBodySchema = z.object({
  type: z.enum(["annual", "sick", "casual", "overtime", "cancel_day_off"]),
  start_date: z.string(),
  end_date: z.string(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  file_url: z.string().optional().nullable(),
});

export const leaveBalancesQuerySchema = z.object({
  year: z.coerce.number().int().positive().optional(),
});

export type CreateLeaveBody = z.infer<typeof createLeaveBodySchema>;
export type LeaveBalancesQuery = z.infer<typeof leaveBalancesQuerySchema>;
