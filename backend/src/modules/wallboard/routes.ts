import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();

router.use(authenticateJWT, requireRole(["manager", "admin"]));

/** Live operations wallboard: agents online, on break, late, overtime, SLA-style counts */
router.get("/", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

  try {
    const userFilter = isAdmin ? "" : "AND u.manager_id = $2";
    const params = isAdmin ? [date] : [date, managerId];

    const { rows: liveRows } = await query(
      `
      SELECT u.id, u.first_name, u.last_name, u.email,
             a.clock_in, a.clock_out, a.is_late, a.is_early_logout, a.overtime_duration,
             (SELECT aux_type FROM auxlogs ax WHERE ax.user_id = u.id AND ax.end_time IS NULL ORDER BY ax.start_time DESC LIMIT 1) AS current_aux
      FROM users u
      LEFT JOIN attendance a ON a.user_id = u.id AND a.shift_date = $1
      WHERE u.role = 'agent' AND u.status = 'active' ${userFilter}
      ORDER BY u.first_name, u.last_name
      `,
      params,
    );

    const agentsOnline = liveRows.filter((r: any) => r.clock_in && !r.clock_out).length;
    const agentsOnBreak = liveRows.filter((r: any) => r.current_aux && ["break", "lunch", "last_break"].includes(r.current_aux)).length;
    const lateToday = liveRows.filter((r: any) => r.is_late).length;
    const overtimeRunning = liveRows.filter((r: any) => r.clock_in && !r.clock_out && r.overtime_duration).length;

    return res.json({
      date,
      agentsOnline,
      agentsOnBreak,
      lateToday,
      overtimeRunning,
      agents: liveRows.map((r: any) => ({
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        status: !r.clock_in ? "off" : r.clock_out ? "clocked_out" : r.current_aux ? "aux" : "available",
        current_aux: r.current_aux || null,
        is_late: r.is_late || false,
        clock_in: r.clock_in,
        clock_out: r.clock_out,
      })),
    });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Wallboard failed" } });
  }
});

export default router;
