import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";
import { upsertSchedule } from "../schedules/repository";
import { getOpenAuxForUser, closeAux, createAux } from "../auxlogs/repository";

const router = Router();
router.use(authenticateJWT, requireRole(["rta", "admin"]));

function canAccessProject(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === "admin") return Promise.resolve(true);
  return query("SELECT 1 FROM rta_projects WHERE user_id = $1 AND project_id = $2", [userId, projectId]).then((r) => r.rows.length > 0);
}

async function canRTAAccessAgent(userId: string, role: string, agentId: string): Promise<boolean> {
  if (role === "admin") return true;
  const { rows } = await query(
    `SELECT 1 FROM schedules s JOIN rta_projects rp ON rp.project_id = s.project_id WHERE rp.user_id = $1 AND s.user_id = $2 LIMIT 1`,
    [userId, agentId],
  );
  return rows.length > 0;
}

// RTA: list my assigned projects
router.get("/projects", async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  try {
    const sql = isAdmin
      ? "SELECT p.* FROM projects p ORDER BY p.name"
      : "SELECT p.* FROM projects p JOIN rta_projects rp ON rp.project_id = p.id WHERE rp.user_id = $1 ORDER BY p.name";
    const { rows } = await query(sql, isAdmin ? [] : [userId]);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Agents (for scheduler - all agents; filter by project usage on frontend if needed)
router.get("/projects/:projectId/agents", async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  try {
    const allowed = await canAccessProject(req.user!.sub, req.user!.role, projectId);
    if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    const { rows } = await query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email FROM users u
       WHERE u.role = 'agent' AND u.status = 'active'
       ORDER BY u.first_name, u.last_name`
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Schedules for a project in date range (for RTA scheduler view)
router.get("/projects/:projectId/schedules", async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const from = req.query.from as string;
  const to = req.query.to as string;
  if (!from || !to) return res.status(400).json({ error: { message: "from and to (YYYY-MM-DD) required" } });
  try {
    const allowed = await canAccessProject(req.user!.sub, req.user!.role, projectId);
    if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    const { rows } = await query(
      `SELECT s.*, u.first_name, u.last_name, u.email FROM schedules s
       JOIN users u ON u.id = s.user_id
       WHERE s.project_id = $1 AND s.date >= $2 AND s.date <= $3
       ORDER BY s.date, u.first_name`,
      [projectId, from, to]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// RTA: upsert one schedule (login, logout, break times)
router.put("/projects/:projectId/schedules", async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const body = req.body as {
    user_id: string;
    date: string;
    shift_start?: string | null;
    shift_end?: string | null;
    break_1_start?: string | null;
    break_1_end?: string | null;
    break_2_start?: string | null;
    break_2_end?: string | null;
    break_3_start?: string | null;
    break_3_end?: string | null;
    day_type?: string;
  };
  if (!body.user_id || !body.date) return res.status(400).json({ error: { message: "user_id and date required" } });
  try {
    const allowed = await canAccessProject(req.user!.sub, req.user!.role, projectId);
    if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    const row = await upsertSchedule({
      userId: body.user_id,
      date: body.date,
      projectId: projectId,
      shiftStart: body.shift_start ?? null,
      shiftEnd: body.shift_end ?? null,
      break1Start: body.break_1_start ?? null,
      break1End: body.break_1_end ?? null,
      break2Start: body.break_2_start ?? null,
      break2End: body.break_2_end ?? null,
      break3Start: body.break_3_start ?? null,
      break3End: body.break_3_end ?? null,
      dayType: body.day_type || "work",
    });
    return res.json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Schedule activities: list (by project + date range or user + date)
router.get("/projects/:projectId/activities", async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const from = req.query.from as string;
  const to = req.query.to as string;
  const userId = req.query.user_id as string | undefined;
  if (!from || !to) return res.status(400).json({ error: { message: "from and to required" } });
  try {
    const allowed = await canAccessProject(req.user!.sub, req.user!.role, projectId);
    if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    let sql = `SELECT a.*, u.first_name, u.last_name FROM schedule_activities a JOIN users u ON u.id = a.user_id WHERE a.activity_date >= $1 AND a.activity_date <= $2 AND (a.project_id = $3 OR a.project_id IS NULL)`;
    const params: any[] = [from, to, projectId];
    if (userId) {
      params.push(userId);
      sql += ` AND a.user_id = $4`;
    }
    sql += ` ORDER BY a.activity_date, a.start_at`;
    const { rows } = await query(sql, params);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Add coaching/meeting (RTA or admin only here; managers use POST /manager/schedule-activities)
router.post("/activities", async (req: AuthRequest, res) => {
  const { user_id, activity_date, project_id, type, start_at, end_at, title, notes } = req.body as {
    user_id?: string;
    activity_date?: string;
    project_id?: string | null;
    type?: string;
    start_at?: string;
    end_at?: string;
    title?: string;
    notes?: string;
  };
  if (!user_id || !activity_date || !type || !start_at || !end_at)
    return res.status(400).json({ error: { message: "user_id, activity_date, type, start_at, end_at required" } });
  if (!["coaching", "meeting", "training"].includes(type))
    return res.status(400).json({ error: { message: "type must be coaching, meeting, or training" } });
  try {
    if (req.user!.role === "rta" && project_id) {
      const allowed = await canAccessProject(req.user!.sub, req.user!.role, project_id);
      if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    }
    const { rows } = await query(
      `INSERT INTO schedule_activities (user_id, activity_date, project_id, type, start_at, end_at, title, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [user_id, activity_date, project_id ?? null, type, start_at, end_at, title ?? null, notes ?? null, req.user!.sub]
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.delete("/activities/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const { rows: act } = await query("SELECT project_id FROM schedule_activities WHERE id = $1", [id]);
    if (!act.length) return res.status(404).json({ error: { message: "Not found" } });
    if (req.user!.role === "rta" && act[0].project_id) {
      const allowed = await canAccessProject(req.user!.sub, req.user!.role, act[0].project_id);
      if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    }
    if (req.user!.role === "manager") {
      const { rows: a } = await query("SELECT user_id FROM schedule_activities WHERE id = $1", [id]);
      if (a.length) {
        const { rows: u } = await query("SELECT manager_id FROM users WHERE id = $1", [a[0].user_id]);
        if (!u.length || u[0].manager_id !== req.user!.sub) return res.status(403).json({ error: { message: "Not your team" } });
      }
    }
    await query("DELETE FROM schedule_activities WHERE id = $1", [id]);
    return res.json({ message: "Deleted" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// RTA: manual punch and AUX corrections (agents in my projects only)
router.post("/attendance/manual", async (req: AuthRequest, res) => {
  const { user_id, clock_in, clock_out } = req.body as { user_id?: string; clock_in?: string; clock_out?: string };
  if (!user_id || !clock_in) return res.status(400).json({ error: { message: "user_id and clock_in required" } });
  const allowed = await canRTAAccessAgent(req.user!.sub, req.user!.role, user_id);
  if (!allowed) return res.status(403).json({ error: { message: "Agent not in your projects" } });
  try {
    const clockOutDate = clock_out ? new Date(clock_out) : null;
    const clockInDate = new Date(clock_in);
    const workedSeconds = clockOutDate ? Math.max(0, Math.floor((clockOutDate.getTime() - clockInDate.getTime()) / 1000)) : 0;
    const totalHours = `${workedSeconds} seconds`;
    const { rows } = await query(
      `INSERT INTO attendance (user_id, clock_in, clock_out, total_hours, is_late, is_early_logout, overtime_duration)
       VALUES ($1, $2, $3, $4::interval, false, false, '0 seconds'::interval) RETURNING *`,
      [user_id, clock_in, clock_out || null, totalHours],
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Manual punch failed" } });
  }
});

router.patch("/attendance/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { clock_in, clock_out } = req.body as { clock_in?: string; clock_out?: string };
  if (!clock_in && !clock_out) return res.status(400).json({ error: { message: "clock_in or clock_out required" } });
  const { rows: existing } = await query(`SELECT a.user_id, a.clock_in, a.clock_out FROM attendance a WHERE a.id = $1`, [id]);
  if (!existing.length) return res.status(404).json({ error: { message: "Attendance not found" } });
  const allowed = await canRTAAccessAgent(req.user!.sub, req.user!.role, existing[0].user_id);
  if (!allowed) return res.status(403).json({ error: { message: "Agent not in your projects" } });
  try {
    const cin = clock_in ? new Date(clock_in) : new Date(existing[0].clock_in);
    const cout = clock_out !== undefined ? (clock_out ? new Date(clock_out) : null) : (existing[0].clock_out ? new Date(existing[0].clock_out) : null);
    const workedSeconds = cout ? Math.max(0, Math.floor((cout.getTime() - cin.getTime()) / 1000)) : 0;
    const totalHours = `${workedSeconds} seconds`;
    const { rows } = await query(
      `UPDATE attendance SET clock_in = $2, clock_out = $3, total_hours = $4::interval WHERE id = $1 RETURNING *`,
      [id, cin.toISOString(), cout?.toISOString() ?? null, totalHours],
    );
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Update failed" } });
  }
});

router.post("/aux/end-for-agent", async (req: AuthRequest, res) => {
  const { user_id } = req.body as { user_id?: string };
  if (!user_id) return res.status(400).json({ error: { message: "user_id required" } });
  const allowed = await canRTAAccessAgent(req.user!.sub, req.user!.role, user_id);
  if (!allowed) return res.status(403).json({ error: { message: "Agent not in your projects" } });
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
  const { user_id, aux_type } = req.body as { user_id?: string; aux_type?: string };
  if (!user_id || !aux_type) return res.status(400).json({ error: { message: "user_id and aux_type required" } });
  const allowed = await canRTAAccessAgent(req.user!.sub, req.user!.role, user_id);
  if (!allowed) return res.status(403).json({ error: { message: "Agent not in your projects" } });
  const allowedTypes = ["break", "lunch", "last_break", "meeting", "coaching", "training", "technical_issue", "floor_support", "available"];
  if (!allowedTypes.includes(aux_type)) return res.status(400).json({ error: { message: "Invalid aux_type" } });
  try {
    const open = await getOpenAuxForUser(user_id);
    if (open) return res.status(400).json({ error: { message: "Agent already has an open AUX. End it first." } });
    const aux = await createAux(user_id, aux_type as any, new Date());
    return res.status(201).json(aux);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
