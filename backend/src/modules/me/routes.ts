import { Router } from "express";
import { authenticateJWT, AuthRequest } from "../../middleware/auth";
import { query } from "../../db/pool";

const router = Router();
router.use(authenticateJWT);

/** Org view: 3 managers above me + my colleagues (same direct manager). */
router.get("/org-view", async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  try {
    const { rows: me } = await query(
      "SELECT id, first_name, last_name, email, role, manager_id FROM users WHERE id = $1",
      [userId]
    );
    if (!me.length) return res.status(404).json({ error: { message: "User not found" } });
    const managersAbove: { id: string; first_name: string; last_name: string; email: string; role: string; level: number }[] = [];
    let currentManagerId: string | null = me[0].manager_id;
    for (let level = 1; level <= 3 && currentManagerId; level++) {
      const { rows: m } = await query(
        "SELECT id, first_name, last_name, email, role, manager_id FROM users WHERE id = $1",
        [currentManagerId]
      );
      if (!m.length) break;
      managersAbove.push({ ...m[0], level });
      currentManagerId = m[0].manager_id;
    }
    const { rows: colleagues } = await query(
      `SELECT id, first_name, last_name, email, role FROM users WHERE manager_id = $1 AND id != $2 AND status = 'active' ORDER BY first_name, last_name`,
      [me[0].manager_id, userId]
    );
    const { rows: directReports } = await query(
      `SELECT id, first_name, last_name, email, role FROM users WHERE manager_id = $1 AND status = 'active' ORDER BY first_name, last_name`,
      [userId]
    );
    const { rows: allReportees } = await query(
      `WITH RECURSIVE reportees(id, first_name, last_name, email, role, manager_id) AS (
        SELECT id, first_name, last_name, email, role, manager_id FROM users WHERE manager_id = $1 AND status = 'active'
        UNION ALL
        SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.manager_id FROM users u
        INNER JOIN reportees r ON u.manager_id = r.id WHERE u.status = 'active'
      )
      SELECT id, first_name, last_name, email, role, manager_id FROM reportees ORDER BY first_name, last_name`,
      [userId]
    );
    function buildReporteesTree(managerId: string): typeof allReportees {
      return allReportees
        .filter((r: { manager_id: string }) => r.manager_id === managerId)
        .map((r: { id: string; first_name: string; last_name: string; email: string; role: string; manager_id: string }) => ({
          id: r.id,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
          role: r.role,
          reportees: buildReporteesTree(r.id),
        }));
    }
    const reporteesTree = buildReporteesTree(userId);
    return res.json({
      me: me[0],
      managersAbove,
      colleagues,
      directReports,
      reporteesTree,
    });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
