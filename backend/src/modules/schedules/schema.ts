import { z } from "zod";

export const scheduleQuerySchema = z.object({
  from: z.string().min(1, "from (YYYY-MM-DD) required"),
  to: z.string().min(1, "to (YYYY-MM-DD) required"),
});

export const schedulePutBodySchema = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().positive().optional(),
  user_id: z.string().uuid(),
  date: z.string(),
  project_id: z.string().uuid().nullable().optional(),
  shift_start: z.string().nullable().optional(),
  shift_end: z.string().nullable().optional(),
  break_1_start: z.string().nullable().optional(),
  break_1_end: z.string().nullable().optional(),
  break_2_start: z.string().nullable().optional(),
  break_2_end: z.string().nullable().optional(),
  break_3_start: z.string().nullable().optional(),
  break_3_end: z.string().nullable().optional(),
  day_type: z.string().default("work"),
});

export const scheduleBatchBodySchema = z.object({
  schedules: z.array(
    z.object({
      user_id: z.string().uuid(),
      date: z.string(),
      project_id: z.string().uuid().nullable().optional(),
      shift_start: z.string().nullable().optional(),
      shift_end: z.string().nullable().optional(),
      break_1_start: z.string().nullable().optional(),
      break_1_end: z.string().nullable().optional(),
      break_2_start: z.string().nullable().optional(),
      break_2_end: z.string().nullable().optional(),
      break_3_start: z.string().nullable().optional(),
      break_3_end: z.string().nullable().optional(),
      day_type: z.string().optional(),
    })
  ).min(1, "schedules array must not be empty"),
});

export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;
export type SchedulePutBody = z.infer<typeof schedulePutBodySchema>;
export type ScheduleBatchBody = z.infer<typeof scheduleBatchBodySchema>;
