import {
  Attendance,
  closeAttendanceSession,
  createClockIn,
  getAttendanceHistoryForUser,
  getOpenAttendanceForUser,
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
    const isLikelyNightShift =
      openDateStr < todayStr && hoursOpen < FORGOTTEN_CLOCK_IN_HOURS;
    if (isLikelyNightShift) {
      throw new Error("You are already clocked in. If you meant to start a new day, ask your manager to close your previous session.");
    }
    if (openDateStr < todayStr) {
      const endOfPrevDay = new Date(openDateStr + "T23:59:59.999Z");
      const workedSeconds = Math.max(0, Math.floor((endOfPrevDay.getTime() - openClockIn.getTime()) / 1000));
      await closeAttendanceSession({
        id: open.id,
        clockOut: endOfPrevDay,
        totalHours: `${workedSeconds} seconds`,
        isEarlyLogout: true,
        overtimeDuration: "0 seconds",
      });
    } else {
      throw new Error("You are already clocked in.");
    }
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

  const tz = await getAppTimezone();
  const shiftDateStr = formatDateInTimezone(open.clock_in, tz);
  const schedule = await getScheduleByUserAndDate(userId, shiftDateStr);
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

