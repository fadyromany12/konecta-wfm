import {
  Attendance,
  closeAttendanceSession,
  createClockIn,
  getAttendanceHistoryForUser,
  getOpenAttendanceForUser,
  hasLockedAttendanceForUserAndDate,
  updateAttendanceStatus,
} from "./repository";
import { getScheduleByUserAndDate } from "../schedules/repository";
import { getAppTimezone } from "../settings/service";
import { formatDateInTimezone, getTodayInTimezone } from "../../utils/dateHelpers";

/** Max hours an open session can span before we treat it as forgotten and auto-close (e.g. night shift should not be auto-closed). */
const FORGOTTEN_CLOCK_IN_HOURS = 16;

export async function clockIn(userId: string, workLocation?: "WFH" | "WFO"): Promise<Attendance> {
  const now = new Date();
  const tz = await getAppTimezone();
  const todayStr = getTodayInTimezone(tz);

  const open = await getOpenAttendanceForUser(userId);
  if (open) {
    const openDateStr = formatDateInTimezone(open.clock_in, tz);
    const openClockIn = new Date(open.clock_in);
    const hoursOpen = (now.getTime() - openClockIn.getTime()) / (3600 * 1000);
    if (openDateStr === todayStr) {
      throw new Error("You are already clocked in.");
    }
    if (openDateStr < todayStr && hoursOpen >= FORGOTTEN_CLOCK_IN_HOURS) {
      await updateAttendanceStatus(open.id, "ANOMALY");
      throw new Error("Previous clock-in was left open over 16 hours and has been marked as an anomaly. Contact your manager to resolve before clocking in again.");
    }
    if (openDateStr < todayStr) {
      throw new Error("You are already clocked in. If you meant to start a new day, ask your manager to close your previous session.");
    }
  }

  const locked = await hasLockedAttendanceForUserAndDate(userId, todayStr);
  if (locked) {
    throw new Error("Timesheet for this date is locked; cannot clock in. Contact your manager.");
  }

  const schedule = await getScheduleByUserAndDate(userId, todayStr);
  let isLate = false;
  if (schedule?.shift_start) {
    const shiftStart = new Date(schedule.shift_start);
    isLate = now > shiftStart;
  }

  return createClockIn(userId, now, isLate, workLocation);
}

export async function clockOut(userId: string): Promise<Attendance> {
  const now = new Date();

  const open = await getOpenAttendanceForUser(userId);
  if (!open) {
    throw new Error("You are not currently clocked in.");
  }
  if ((open as Attendance & { timesheet_approved?: boolean }).timesheet_approved) {
    throw new Error("This timesheet is locked; cannot clock out. Contact your manager.");
  }

  const tz = await getAppTimezone();
  const shiftDateStr = formatDateInTimezone(open.clock_in, tz);
  const schedule = await getScheduleByUserAndDate(userId, shiftDateStr);
  let isEarlyLogout = false;

  const clockInTime = new Date(open.clock_in);
  const workedSeconds = Math.max(0, Math.floor((now.getTime() - clockInTime.getTime()) / 1000));

  if (schedule?.shift_end) {
    const shiftEnd = new Date(schedule.shift_end);
    if (now < shiftEnd) {
      isEarlyLogout = true;
    }
  }

  const totalHoursInterval = `${workedSeconds} seconds`;
  // Overtime is calculated weekly (e.g. over 40h) by a background/sync utility, not per shift.
  const overtimeInterval = "0 seconds";

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

