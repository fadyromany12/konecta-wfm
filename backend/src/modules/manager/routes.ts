import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { runInTransaction } from "../../db/pool";
import { getTeamSchedulesByManager, upsertSchedule, updateSchedule, batchUpsertSchedules, getScheduleByUserAndDate } from "../schedules/repository";
import { schedulePutBodySchema, scheduleBatchBodySchema } from "../schedules/schema";
import { createNotification } from "../notifications/repository";
import { approveAgentAndSetTempPassword, setTempPasswordForUser } from "../auth/service";
import { approveLeave } from "../leave/service";
import { getOpenAuxForUser, closeAux, createAux } from "../auxlogs/repository";
import { lockAttendanceRecords, hasLockedAttendanceForUserAndDate } from "../attendance/repository";
import { daysAgo } from "../../utils/dateHelpers";
import { logAudit } from "../../lib/audit";
import * as repo from "./repository";
import * as svc from "./service";

const router = Router();

router.get("/transfer-requests", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  const filter = (req.query.filter as string) || "pending_approval";
  try {
    const rows = await svc.getTransferRequests(userId, isAdmin, filter);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.patch("/transfer-requests/:id/approve", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const approverId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  const { id } = req.params;
  try {
    const r = await svc.approveTransfer(id, approverId, isAdmin);
    if (!r) return res.status(404).json({ error: { message: "Request not found or not pending" } });
    return res.json({ message: "Approved" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.patch("/transfer-requests/:id/reject", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const approverId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  const { id } = req.params;
  try {
    const r = await svc.rejectTransfer(id, approverId, isAdmin);
    if (!r) return res.status(404).json({ error: { message: "Request not found or not pending" } });
    return res.json({ message: "Rejected" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/team-with-manager", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  try {
    const rows = isAdmin ? await repo.getTeamWithManagerAll() : await repo.getTeamWithManager(managerId);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/org-tree", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  try {
    const all = await repo.getUsersForOrgTree();
    const root = svc.buildOrgTree(all, isAdmin ? null : userId);
    return res.json(root);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.use(authenticateJWT, requireRole(["manager"]));

router.get("/pending-approvals", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  try {
    const rows = await repo.getPendingApprovals(managerId);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/approve/:userId", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { userId } = req.params;
  try {
    const u = await repo.getUserForApprove(userId, managerId);
    if (!u) return res.status(404).json({ error: { message: "User not found or not your report" } });
    const { tempPassword } = await approveAgentAndSetTempPassword(userId);
    const name = await repo.getUserName(userId);
    await createNotification(userId, "Your account has been approved. Use the temporary password your manager gave you, then change it in Profile.", "approved");
    return res.json({ message: "Approved", tempPassword, userName: name ? `${name.first_name} ${name.last_name}` : "" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Approve failed" } });
  }
});

router.get("/password-reset-requests", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  try {
    const rows = await repo.getPasswordResetRequests(managerId);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/set-temp-password/:userId", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { userId } = req.params;
  try {
    const u = await repo.getUserByManager(userId, managerId);
    if (!u) return res.status(404).json({ error: { message: "User not found or not your report" } });
    const { tempPassword } = await setTempPasswordForUser(managerId, userId);
    await createNotification(userId, "A new temporary password has been set for you. Log in and change it in Profile.", "temp_password");
    return res.json({ message: "Temp password set", tempPassword });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/managers-list", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  try {
    const rows = await repo.getManagersList(req.user!.sub);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/transfer-request", async (req: AuthRequest, res) => {
  const fromManagerId = req.user!.sub;
  const { agentId, toManagerId } = req.body as { agentId?: string; toManagerId?: string };
  if (!agentId || !toManagerId) return res.status(400).json({ error: { message: "agentId and toManagerId required" } });
  if (agentId === toManagerId) return res.status(400).json({ error: { message: "Agent and new manager must differ" } });
  try {
    const row = await svc.createTransfer(agentId, fromManagerId, toManagerId);
    if (!row) return res.status(404).json({ error: { message: "Agent not in your team or target must be a manager" } });
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/team-summary", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const from = (req.query.from as string) || daysAgo(30);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  try {
    const result = await svc.getTeamSummary(managerId, from, to);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/team-aux-today", authenticateJWT, requireRole(["manager"]), async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const rows = await repo.getTeamAuxToday(managerId, today);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/team", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 100), 500);
  const offset = (page - 1) * limit;
  try {
    const [rows, total] = await Promise.all([
      repo.getTeamPaginated(managerId, limit, offset),
      repo.getTeamCount(managerId),
    ]);
    return res.json({ data: rows, total });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch team failed" } });
  }
});

router.get("/attendance/team", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const targetDate = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  try {
    const rows = await repo.getTeamAttendance(managerId, targetDate);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch team attendance failed" } });
  }
});

function escapeCsv(v: any): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatIntervalForCsv(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "hours" in v) {
    const o = v as { hours?: number; minutes?: number; seconds?: number };
    return `${o.hours ?? 0}:${String(o.minutes ?? 0).padStart(2, "0")}:${String(o.seconds ?? 0).padStart(2, "0")}`;
  }
  return String(v);
}

// Manager reports: CSV exports for my team only
router.get("/export/attendance", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const from = (req.query.from as string) || daysAgo(30);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  try {
    const rows = await repo.getExportAttendance(managerId, from, to);
    const header = "id,first_name,last_name,email,clock_in,clock_out,total_hours,is_late,is_early_logout,overtime_duration,shift_date";
    const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.clock_in, r.clock_out, formatIntervalForCsv(r.total_hours), r.is_late, r.is_early_logout, formatIntervalForCsv(r.overtime_duration), r.shift_date].map(String).map(escapeCsv).join(","))];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=team-attendance-${from}-${to}.csv`);
    return res.send(lines.join("\r\n"));
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

router.get("/export/leave", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const from = (req.query.from as string) || daysAgo(90);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  try {
    const rows = await repo.getExportLeave(managerId, from, to);
    const header = "id,first_name,last_name,email,type,start_date,end_date,reason,status,created_at";
    const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.type, r.start_date, r.end_date, r.reason, r.status, r.created_at].map(String).map(escapeCsv).join(","))];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=team-leave-${from}-${to}.csv`);
    return res.send(lines.join("\r\n"));
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

router.get("/export/aux", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const from = (req.query.from as string) || daysAgo(30);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  try {
    const rows = await repo.getExportAux(managerId, from, to);
    const header = "id,first_name,last_name,email,aux_type,start_time,end_time,duration,over_limit";
    const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.aux_type, r.start_time, r.end_time, r.duration, r.over_limit].map(String).map(escapeCsv).join(","))];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=team-aux-${from}-${to}.csv`);
    return res.send(lines.join("\r\n"));
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

router.get("/leave/pending", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  try {
    const rows = await repo.getLeavePending(managerId);
    const normalized = rows.map((r: any) => ({ ...r, start_date: svc.toDateOnly(r.start_date), end_date: svc.toDateOnly(r.end_date) }));
    return res.json(normalized);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch pending leave failed" } });
  }
});

router.get("/leave/team", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  try {
    const rows = await repo.getLeaveTeam(managerId);
    const normalized = rows.map((r: any) => ({ ...r, start_date: svc.toDateOnly(r.start_date), end_date: svc.toDateOnly(r.end_date) }));
    return res.json(normalized);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch team leave failed" } });
  }
});

router.post("/leave/:id/approve", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { id } = req.params;
  try {
    const { userId } = await approveLeave(id, managerId);
    await createNotification(userId, "Your leave request has been approved.", "leave_approved");
    return res.json({ message: "Leave approved" });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : "Approve leave failed";
    const status = message.includes("not found") ? 404 : 400;
    return res.status(status).json({ error: { message } });
  }
});

router.post("/leave/:id/reject", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { id } = req.params;
  try {
    const leave = await repo.getLeaveRequestForReject(id, managerId);
    if (!leave) return res.status(404).json({ error: { message: "Leave request not found or not in your team" } });
    await repo.rejectLeaveRequest(id, managerId);
    await logAudit("leave.reject", managerId, { leave_id: id, target_user_id: leave.user_id }, req.ip);
    await createNotification(leave.user_id, "Your leave request has been rejected.", "leave_rejected");
    return res.json({ message: "Leave rejected" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Reject leave failed" } });
  }
});

router.get("/schedule/team", async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) {
    return res.status(400).json({ error: { message: "Query from and to (YYYY-MM-DD) required" } });
  }
  try {
    const list = await getTeamSchedulesByManager(req.user!.sub, from, to);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to fetch schedule" } });
  }
});

router.put("/schedule", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const parsed = schedulePutBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors?.[0]?.message ?? "Validation failed";
    return res.status(400).json({ error: { message: msg } });
  }
  const { id, version, user_id, date, shift_start, shift_end, day_type } = parsed.data;
  const u = await repo.getUserByManager(user_id, managerId);
  if (!u) return res.status(403).json({ error: { message: "Agent not in your team" } });
  const params = {
    userId: user_id,
    date,
    projectId: parsed.data.project_id ?? null,
    shiftStart: shift_start ?? null,
    shiftEnd: shift_end ?? null,
    break1Start: parsed.data.break_1_start ?? null,
    break1End: parsed.data.break_1_end ?? null,
    break2Start: parsed.data.break_2_start ?? null,
    break2End: parsed.data.break_2_end ?? null,
    break3Start: parsed.data.break_3_start ?? null,
    break3End: parsed.data.break_3_end ?? null,
    dayType: day_type || "work",
  };
  try {
    if (id != null && version != null) {
      const existing = await getScheduleByUserAndDate(user_id, date);
      if (!existing || existing.id !== id) return res.status(400).json({ error: { message: "Schedule not found" } });
      const row = await updateSchedule(id, version, params);
      await logAudit("schedule.update", managerId, { schedule_id: row.id, target_user_id: user_id, date, scope: "manager" }, req.ip);
      return res.json(row);
    }
    const row = await upsertSchedule(params);
    await logAudit("schedule.update", managerId, { schedule_id: row.id, target_user_id: user_id, date, scope: "manager" }, req.ip);
    return res.json(row);
  } catch (err: any) {
    if (err?.message === "CONFLICT") return res.status(409).json({ error: { message: "Schedule was updated by someone else; refresh and try again." } });
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/schedule/batch", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const parsed = scheduleBatchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors?.[0]?.message ?? "Validation failed";
    return res.status(400).json({ error: { message: msg } });
  }
  const list = parsed.data.schedules;
  for (const s of list) {
    const u = await repo.getUserByManager(s.user_id, managerId);
    if (!u) return res.status(403).json({ error: { message: `Agent ${s.user_id} not in your team` } });
  }
  const items = list.map((s) => ({
    userId: s.user_id,
    date: s.date,
    projectId: s.project_id ?? null,
    shiftStart: s.shift_start ?? null,
    shiftEnd: s.shift_end ?? null,
    break1Start: s.break_1_start ?? null,
    break1End: s.break_1_end ?? null,
    break2Start: s.break_2_start ?? null,
    break2End: s.break_2_end ?? null,
    break3Start: s.break_3_start ?? null,
    break3End: s.break_3_end ?? null,
    dayType: s.day_type || "work",
  }));
  try {
    const result = await runInTransaction((client) => batchUpsertSchedules(items, client));
    await logAudit("schedule.batch", managerId, { inserted: result.inserted, updated: result.updated, scope: "manager" }, req.ip);
    return res.json({ inserted: result.inserted, updated: result.updated });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Batch failed" } });
  }
});

router.post("/schedule-activities", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id, activity_date, type, start_at, end_at, title, notes } = req.body as {
    user_id?: string;
    activity_date?: string;
    type?: string;
    start_at?: string;
    end_at?: string;
    title?: string;
    notes?: string;
  };
  if (!user_id || !activity_date || !type || !start_at || !end_at) {
    return res.status(400).json({ error: { message: "user_id, activity_date, type, start_at, end_at required" } });
  }
  if (!["coaching", "meeting", "training"].includes(type)) {
    return res.status(400).json({ error: { message: "type must be coaching, meeting, or training" } });
  }
  try {
    const u = await repo.getUserByManager(user_id, managerId);
    if (!u) return res.status(403).json({ error: { message: "Agent not in your team" } });
    const row = await repo.createScheduleActivity(user_id, activity_date, type, start_at, end_at, title ?? null, notes ?? null, managerId);
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/attendance/approve-timesheet", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id, from, to } = req.body as { user_id?: string; from?: string; to?: string };
  if (!user_id || !from || !to) return res.status(400).json({ error: { message: "user_id, from, and to (YYYY-MM-DD) required" } });
  const u = await repo.getUserByManager(user_id, managerId);
  if (!u) return res.status(403).json({ error: { message: "Agent not in your team" } });
  try {
    const locked = await lockAttendanceRecords(user_id, from, to);
    return res.json({ message: "Timesheet approved", lockedCount: locked });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/attendance/manual", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id, clock_in, clock_out } = req.body as { user_id?: string; clock_in?: string; clock_out?: string };
  if (!user_id || !clock_in) return res.status(400).json({ error: { message: "user_id and clock_in required" } });
  const u = await repo.getUserByManager(user_id, managerId);
  if (!u) return res.status(403).json({ error: { message: "Agent not in your team" } });
  const dateStr = clock_in.slice(0, 10);
  const locked = await hasLockedAttendanceForUserAndDate(user_id, dateStr);
  if (locked) return res.status(400).json({ error: { message: "Timesheet for this date is locked; cannot add punch." } });
  try {
    const clockOutDate = clock_out ? new Date(clock_out) : null;
    const clockInDate = new Date(clock_in);
    const workedSeconds = clockOutDate ? Math.max(0, Math.floor((clockOutDate.getTime() - clockInDate.getTime()) / 1000)) : 0;
    const totalHours = `${workedSeconds} seconds`;
    const row = await repo.insertAttendanceManual(user_id, clock_in, clock_out || null, totalHours);
    await logAudit("attendance.manual", managerId, { attendance_id: row.id, target_user_id: user_id, clock_in, clock_out: clock_out || null }, req.ip);
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Manual punch failed" } });
  }
});

router.patch("/attendance/:id", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { id } = req.params;
  const { clock_in, clock_out } = req.body as { clock_in?: string; clock_out?: string };
  if (!clock_in && !clock_out) return res.status(400).json({ error: { message: "clock_in or clock_out required" } });
  const existing = await repo.getAttendanceByIdAndManager(id, managerId);
  if (!existing) return res.status(404).json({ error: { message: "Attendance not found or not in your team" } });
  if (existing.timesheet_approved) return res.status(400).json({ error: { message: "Timesheet is locked; cannot edit." } });
  try {
    const cin = clock_in ? new Date(clock_in) : new Date(existing.clock_in);
    const cout = clock_out !== undefined ? (clock_out ? new Date(clock_out) : null) : (existing.clock_out ? new Date(existing.clock_out) : null);
    const workedSeconds = cout ? Math.max(0, Math.floor((cout.getTime() - cin.getTime()) / 1000)) : 0;
    const totalHours = `${workedSeconds} seconds`;
    const row = await repo.updateAttendancePunch(id, cin.toISOString(), cout?.toISOString() ?? null, totalHours);
    await logAudit("attendance.override", managerId, { attendance_id: id, target_user_id: existing.user_id, clock_in: cin.toISOString(), clock_out: cout?.toISOString() ?? null }, req.ip);
    return res.json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Update failed" } });
  }
});

router.get("/attendance/anomalies", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  try {
    const rows = await repo.getAnomaliesForManager(managerId);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.patch("/attendance/:id/resolve-anomaly", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { id } = req.params;
  const { clock_out: clockOutReq } = req.body as { clock_out?: string };
  if (!clockOutReq) return res.status(400).json({ error: { message: "clock_out required" } });
  const existing = await repo.getAttendanceByIdAndManager(id, managerId);
  if (!existing) return res.status(404).json({ error: { message: "Attendance not found or not in your team" } });
  if (existing.status !== "ANOMALY") return res.status(400).json({ error: { message: "Record is not an anomaly or already resolved" } });
  try {
    const clockInDate = new Date(existing.clock_in);
    const clockOutDate = new Date(clockOutReq);
    const workedSeconds = Math.max(0, Math.floor((clockOutDate.getTime() - clockInDate.getTime()) / 1000));
    const totalHours = `${workedSeconds} seconds`;
    const row = await repo.resolveAnomaly(id, managerId, clockOutReq, totalHours);
    if (!row) return res.status(400).json({ error: { message: "Could not resolve anomaly" } });
    await logAudit("attendance.anomaly_resolve", managerId, { attendance_id: id, target_user_id: existing.user_id, clock_out: clockOutReq }, req.ip);
    return res.json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Resolve failed" } });
  }
});

router.post("/aux/end-for-agent", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id } = req.body as { user_id?: string };
  if (!user_id) return res.status(400).json({ error: { message: "user_id required" } });
  const u = await repo.getUserByManager(user_id, managerId);
  if (!u) return res.status(403).json({ error: { message: "Agent not in your team" } });
  try {
    const open = await getOpenAuxForUser(user_id);
    if (!open) return res.status(404).json({ error: { message: "No open AUX for this agent" } });
    const end = new Date();
    const start = new Date(open.start_time);
    const durationSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    await closeAux({ id: open.id, end, durationSeconds, overLimit: false });
    return res.json({ message: "AUX ended" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/aux/start-for-agent", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id, aux_type } = req.body as { user_id?: string; aux_type?: string };
  if (!user_id || !aux_type) return res.status(400).json({ error: { message: "user_id and aux_type required" } });
  const u = await repo.getUserByManager(user_id, managerId);
  if (!u) return res.status(403).json({ error: { message: "Agent not in your team" } });
  const allowed = ["break", "lunch", "last_break", "meeting", "coaching", "training", "technical_issue", "floor_support", "available"];
  if (!allowed.includes(aux_type)) return res.status(400).json({ error: { message: "Invalid aux_type" } });
  try {
    const open = await getOpenAuxForUser(user_id);
    if (open) return res.status(400).json({ error: { message: "Agent already has an open AUX. End it first." } });
    const aux = await createAux(user_id, aux_type as any, new Date());
    return res.status(201).json(aux);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/notes", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const userId = req.query.user_id as string | undefined;
  try {
    const rows = await repo.getManagerNotes(managerId, userId);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch notes failed" } });
  }
});

router.post("/notes", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id, note_type, content } = req.body as { user_id?: string; note_type?: string; content?: string };
  if (!user_id || !content) return res.status(400).json({ error: { message: "user_id and content required" } });
  try {
    const row = await repo.createManagerNote(user_id, managerId, note_type || "general", content);
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Add note failed" } });
  }
});

router.get("/disciplinary", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const userId = req.query.user_id as string | undefined;
  try {
    const rows = await repo.getDisciplinary(managerId, userId);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch disciplinary failed" } });
  }
});

router.post("/disciplinary", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id, action_type, description, severity } = req.body as { user_id?: string; action_type?: string; description?: string; severity?: string };
  if (!user_id || !action_type) return res.status(400).json({ error: { message: "user_id and action_type required" } });
  try {
    const row = await repo.createDisciplinary(user_id, managerId, action_type, description || null, severity || "warning");
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Add disciplinary failed" } });
  }
});

router.get("/scores", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const period = (req.query.period as string) || "week";
  const today = new Date();
  let periodStart: string;
  let periodEnd: string;
  if (period === "month") {
    periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    periodEnd = today.toISOString().slice(0, 10);
  } else {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    periodStart = d.toISOString().slice(0, 10);
    periodEnd = today.toISOString().slice(0, 10);
  }
  try {
    const rows = await repo.getAttendanceScores(managerId, periodStart, periodEnd);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch scores failed" } });
  }
});

router.get("/alerts", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const resolved = req.query.resolved as string | undefined;
  try {
    const rows = await repo.getAlerts(managerId, resolved);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch alerts failed" } });
  }
});

router.patch("/alerts/:id/resolve", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { id } = req.params;
  try {
    const ok = await repo.resolveAlert(id, managerId);
    if (!ok) return res.status(404).json({ error: { message: "Alert not found" } });
    return res.json({ message: "Resolved" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Resolve failed" } });
  }
});

export default router;

