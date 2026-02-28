import { query } from "../../db/pool";
import {
  Attendance,
  closeAttendanceSession,
  createClockIn,
  getAttendanceHistoryForUser,
  getOpenAttendanceForUser,
} from "./repository";

interface ScheduleRow {
  shift_start: string | null;
  shift_end: string | null;
}

async function getTodaySchedule(userId: string, now: Date): Promise<ScheduleRow | null> {
  const dateStr = now.toISOString().slice(0, 10);
  const { rows } = await query<ScheduleRow>(
    `SELECT shift_start, shift_end FROM schedules WHERE user_id = $1 AND date = $2`,
    [userId, dateStr],
  );
  return rows[0] || null;
}

export async function clockIn(userId: string): Promise<Attendance> {
  const now = new Date();

  const open = await getOpenAttendanceForUser(userId);
  if (open) {
    throw new Error("You are already clocked in.");
  }

  const schedule = await getTodaySchedule(userId, now);
  let isLate = false;

  if (schedule?.shift_start) {
    const shiftStart = new Date(schedule.shift_start);
    isLate = now > shiftStart;
  }

  return createClockIn(userId, now, isLate);
}

export async function clockOut(userId: string): Promise<Attendance> {
  const now = new Date();

  const open = await getOpenAttendanceForUser(userId);
  if (!open) {
    throw new Error("You are not currently clocked in.");
  }

  const schedule = await getTodaySchedule(userId, now);
  let isEarlyLogout = false;
  let overtimeSeconds = 0;

  const clockInTime = new Date(open.clock_in);
  const workedSeconds = Math.max(0, Math.floor((now.getTime() - clockInTime.getTime()) / 1000));

  if (schedule?.shift_end) {
    const shiftEnd = new Date(schedule.shift_end);
    if (now < shiftEnd) {
      isEarlyLogout = true;
    } else {
      const scheduledSeconds = Math.max(
        0,
        Math.floor((shiftEnd.getTime() - clockInTime.getTime()) / 1000),
      );
      overtimeSeconds = Math.max(0, workedSeconds - scheduledSeconds);
    }
  }

  const totalHoursInterval = `${workedSeconds} seconds`;
  const overtimeInterval = `${overtimeSeconds} seconds`;

  return closeAttendanceSession({
    id: open.id,
    clockOut: now,
    totalHours: totalHoursInterval,
    isEarlyLogout,
    overtimeDuration: overtimeInterval,
  });
}

export async function getMyAttendanceHistory(userId: string, from?: string, to?: string) {
  return getAttendanceHistoryForUser(userId, from, to);
}

