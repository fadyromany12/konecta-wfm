import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();
router.use(authenticateJWT);

interface GridEvent {
  type: string;
  start: string;
  end: string;
  duration_minutes: number;
  violation?: string;
  label?: string;
}

interface UserGrid {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  events: GridEvent[];
  violations: { type: string; description: string }[];
}

// 36h activity grid: filter by date, optional project_id, optional user_id. Batched queries to avoid N+1.
router.get("/activity", requireRole(["agent", "manager", "admin", "project_manager", "rta"]), async (req: AuthRequest, res) => {
  const date = req.query.date as string;
  const projectId = req.query.project_id as string | undefined;
  const userIdFilter = req.query.user_id as string | undefined;
  if (!date) return res.status(400).json({ error: { message: "date (YYYY-MM-DD) required" } });

  const role = req.user!.role;
  const currentUserId = req.user!.sub;

  try {
    let usersSql = `SELECT id, first_name, last_name, email FROM users WHERE status = 'active' AND role = 'agent'`;
    const userParams: (string | string[])[] = [];
    if (userIdFilter) {
      userParams.push(userIdFilter);
      usersSql += ` AND id = $${userParams.length}`;
    }
    if (role === "manager") {
      userParams.push(currentUserId);
      usersSql += ` AND manager_id = $${userParams.length}`;
    }
    if (role === "agent") {
      usersSql += ` AND id = $1`;
      userParams.length = 0;
      userParams.push(currentUserId);
    }
    usersSql += ` ORDER BY first_name, last_name`;
    const { rows: users } = await query<{ id: string; first_name: string; last_name: string; email: string }>(usersSql, userParams);

    if (users.length === 0) {
      return res.json({ date, project_id: projectId || null, users: [] });
    }

    const userIds = users.map((u) => u.id);

    const [attendanceAll, auxAll, scheduleAll, activityAll] = await Promise.all([
      query<{ user_id: string; clock_in: string; clock_out: string | null; is_late: boolean }>(
        `SELECT user_id, clock_in, clock_out, is_late FROM attendance WHERE user_id = ANY($1::uuid[]) AND shift_date = $2`,
        [userIds, date],
      ),
      query<{ user_id: string; aux_type: string; start_time: string; end_time: string | null; duration: string | null; over_limit: boolean }>(
        `SELECT user_id, aux_type, start_time, end_time, duration, over_limit FROM auxlogs WHERE user_id = ANY($1::uuid[]) AND start_time::date = $2 ORDER BY start_time`,
        [userIds, date],
      ),
      query(`SELECT * FROM schedules WHERE user_id = ANY($1::uuid[]) AND date = $2`, [userIds, date]),
      query<{ user_id: string; type: string; start_at: string; end_at: string; title: string | null }>(
        `SELECT user_id, type, start_at, end_at, title FROM schedule_activities WHERE user_id = ANY($1::uuid[]) AND activity_date = $2 ORDER BY start_at`,
        [userIds, date],
      ),
    ]);

    const attendanceByUser = new Map<string, { clock_in: string; clock_out: string | null; is_late: boolean }[]>();
    for (const r of attendanceAll.rows as { user_id: string; clock_in: string; clock_out: string | null; is_late: boolean }[]) {
      const list = attendanceByUser.get(r.user_id) || [];
      list.push(r);
      attendanceByUser.set(r.user_id, list);
    }
    const auxByUser = new Map<string, { aux_type: string; start_time: string; end_time: string | null; duration: string | null; over_limit: boolean }[]>();
    for (const r of auxAll.rows as { user_id: string; aux_type: string; start_time: string; end_time: string | null; duration: string | null; over_limit: boolean }[]) {
      const list = auxByUser.get(r.user_id) || [];
      list.push(r);
      auxByUser.set(r.user_id, list);
    }
    const scheduleByUser = new Map<string, Record<string, unknown>>();
    for (const r of scheduleAll.rows as Record<string, unknown>[]) {
      const uid = r.user_id as string;
      scheduleByUser.set(uid, r);
    }
    const activityByUser = new Map<string, { type: string; start_at: string; end_at: string; title: string | null }[]>();
    for (const r of activityAll.rows as { user_id: string; type: string; start_at: string; end_at: string; title: string | null }[]) {
      const list = activityByUser.get(r.user_id) || [];
      list.push({ type: r.type, start_at: r.start_at, end_at: r.end_at, title: r.title });
      activityByUser.set(r.user_id, list);
    }

    const result: UserGrid[] = [];
    for (const u of users) {
      const events: GridEvent[] = [];
      const violations: { type: string; description: string }[] = [];
      const schedule = scheduleByUser.get(u.id) as { shift_start?: string; shift_end?: string; break_1_start?: string; break_1_end?: string; break_2_start?: string; break_2_end?: string; break_3_start?: string; break_3_end?: string } | undefined;

      if (schedule?.shift_start) {
        const start = new Date(schedule.shift_start).toISOString();
        const end = schedule.shift_end ? new Date(schedule.shift_end).toISOString() : start;
        events.push({
          type: "scheduled_shift",
          start,
          end,
          duration_minutes: schedule.shift_end ? Math.round((new Date(schedule.shift_end).getTime() - new Date(schedule.shift_start).getTime()) / 60000) : 0,
          label: "Scheduled",
        });
      }
      for (const b of ["break_1", "break_2", "break_3"] as const) {
        const s = schedule?.[`${b}_start`];
        const e = schedule?.[`${b}_end`];
        if (s && e) {
          events.push({
            type: `scheduled_${b}`,
            start: new Date(s).toISOString(),
            end: new Date(e).toISOString(),
            duration_minutes: Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000),
            label: b.replace("_", " "),
          });
        }
      }

      const attendanceRows = attendanceByUser.get(u.id) || [];
      for (const a of attendanceRows) {
        events.push({
          type: "clock_in",
          start: new Date(a.clock_in).toISOString(),
          end: new Date(a.clock_in).toISOString(),
          duration_minutes: 0,
          violation: a.is_late ? "lateness" : undefined,
          label: "Clock in" + (a.is_late ? " (late)" : ""),
        });
        if (a.clock_out) {
          const start = new Date(a.clock_in).getTime();
          const end = new Date(a.clock_out).getTime();
          events.push({
            type: "work",
            start: new Date(a.clock_in).toISOString(),
            end: new Date(a.clock_out).toISOString(),
            duration_minutes: Math.round((end - start) / 60000),
            label: "Work",
          });
          events.push({
            type: "clock_out",
            start: new Date(a.clock_out).toISOString(),
            end: new Date(a.clock_out).toISOString(),
            duration_minutes: 0,
            label: "Clock out",
          });
        }
      }

      const auxRows = auxByUser.get(u.id) || [];
      for (const aux of auxRows) {
        const end = aux.end_time || new Date().toISOString();
        const start = new Date(aux.start_time).getTime();
        const endMs = new Date(end).getTime();
        const durationMinutes = Math.round((endMs - start) / 60000);
        events.push({
          type: "aux",
          start: new Date(aux.start_time).toISOString(),
          end,
          duration_minutes: durationMinutes,
          violation: aux.over_limit ? "break_violation" : undefined,
          label: aux.aux_type + (aux.over_limit ? " (over limit)" : ""),
        });
        if (aux.over_limit) violations.push({ type: "break_violation", description: `${aux.aux_type} exceeded allowed duration` });
      }

      const activityRows = activityByUser.get(u.id) || [];
      for (const act of activityRows) {
        events.push({
          type: act.type,
          start: new Date(act.start_at).toISOString(),
          end: new Date(act.end_at).toISOString(),
          duration_minutes: Math.round((new Date(act.end_at).getTime() - new Date(act.start_at).getTime()) / 60000),
          label: act.title || act.type,
        });
      }

      const firstAttendance = attendanceRows[0];
      if (firstAttendance?.is_late) violations.push({ type: "lateness", description: "Clock-in was after scheduled start" });

      events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      result.push({
        user_id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        events,
        violations,
      });
    }

    return res.json({ date, project_id: projectId || null, users: result });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
