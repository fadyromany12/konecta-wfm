import { query } from "../../db/pool";
import * as repo from "./repository";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export async function validateShiftForUser(
  userId: string,
  date: string,
  shiftStart: string,
  shiftEnd: string,
  excludeScheduleId?: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const dailyMax = await repo.getNumeric("daily_max_hours", 12);
  const weeklyMax = await repo.getNumeric("weekly_max_hours", 48);
  const minRestHours = await repo.getNumeric("min_rest_between_shifts_hours", 11);

  const start = new Date(shiftStart);
  const end = new Date(shiftEnd);
  const shiftHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  const dateStart = new Date(date + "T00:00:00Z");
  const weekStart = new Date(dateStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { rows: dayRows } = await query<{ shift_start: string; shift_end: string; id: string }>(
    "SELECT id, shift_start::text, shift_end::text FROM schedules WHERE user_id = $1 AND date = $2 AND shift_start IS NOT NULL AND shift_end IS NOT NULL",
    [userId, date],
  );
  let dayTotal = 0;
  for (const row of dayRows) {
    if (excludeScheduleId && row.id === excludeScheduleId) continue;
    const s = new Date(row.shift_start);
    const e = new Date(row.shift_end);
    dayTotal += (e.getTime() - s.getTime()) / (1000 * 60 * 60);
  }
  dayTotal += shiftHours;
  if (dayTotal > dailyMax) errors.push("Daily hours exceed max " + dailyMax + "h");

  const { rows: weekRows } = await query<{ id: string; shift_start: string; shift_end: string }>(
    "SELECT id, shift_start::text, shift_end::text FROM schedules WHERE user_id = $1 AND date >= $2 AND date <= $3 AND shift_start IS NOT NULL AND shift_end IS NOT NULL",
    [userId, weekStart.toISOString().slice(0, 10), weekEnd.toISOString().slice(0, 10)],
  );
  let weekTotal = 0;
  for (const row of weekRows) {
    if (excludeScheduleId && row.id === excludeScheduleId) continue;
    const s = new Date(row.shift_start);
    const e = new Date(row.shift_end);
    weekTotal += (e.getTime() - s.getTime()) / (1000 * 60 * 60);
  }
  if (!excludeScheduleId || !weekRows.some((r) => r.id === excludeScheduleId)) weekTotal += shiftHours;
  if (weekTotal > weeklyMax) errors.push("Weekly hours exceed max " + weeklyMax + "h");

  const prevDay = new Date(dateStart);
  prevDay.setDate(prevDay.getDate() - 1);
  const nextDay = new Date(dateStart);
  nextDay.setDate(nextDay.getDate() + 1);
  const { rows: adjacentRows } = await query<{ shift_end: string; shift_start: string }>(
    "SELECT shift_start::text, shift_end::text FROM schedules WHERE user_id = $1 AND date IN ($2, $3) AND shift_start IS NOT NULL AND shift_end IS NOT NULL",
    [userId, prevDay.toISOString().slice(0, 10), nextDay.toISOString().slice(0, 10)],
  );
  for (const row of adjacentRows) {
    const otherStart = new Date(row.shift_start);
    const otherEnd = new Date(row.shift_end);
    const restBefore = (start.getTime() - otherEnd.getTime()) / (1000 * 60 * 60);
    const restAfter = (otherStart.getTime() - end.getTime()) / (1000 * 60 * 60);
    if (restBefore > 0 && restBefore < minRestHours) errors.push("Rest before shift less than " + minRestHours + "h");
    if (restAfter > 0 && restAfter < minRestHours) errors.push("Rest after shift less than " + minRestHours + "h");
  }

  return { valid: errors.length === 0, errors };
}
