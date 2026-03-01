import { runInTransaction, query } from "../../db/pool";
import { deductBalance, ensureBalance } from "../leaveBalances/repository";
import { insertException } from "../scheduleExceptions/repository";
import { dateRangeArray } from "../../utils/dateHelpers";

/**
 * Approve a leave request. Must run atomically: update status, insert schedule_exceptions, deduct balance.
 * Caller must ensure manager is authorized (e.g. canManageUser(managerId, leave.user_id)).
 */
export async function approveLeave(leaveId: string, managerId: string): Promise<{ userId: string }> {
  let userId: string;
  await runInTransaction(async (client) => {
    const { rows: leaveRows } = await query<{ user_id: string; type: string; start_date: string; end_date: string }>(
      `SELECT lr.user_id, lr.type, lr.start_date, lr.end_date
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = $1 AND u.manager_id = $2 AND lr.status = 'pending'`,
      [leaveId, managerId],
      client,
    );
    if (!leaveRows.length) {
      throw new Error("Leave request not found or not in your team");
    }
    const leave = leaveRows[0];
    userId = leave.user_id;

    await query(
      `UPDATE leave_requests SET status = 'approved', approved_by = $2, updated_at = now() WHERE id = $1`,
      [leaveId, managerId],
      client,
    );

    for (const dateStr of dateRangeArray(leave.start_date, leave.end_date)) {
      await insertException(
        {
          userId: leave.user_id,
          date: dateStr,
          exceptionType: "leave",
          refId: leaveId,
          shiftStart: null,
          shiftEnd: null,
        },
        client,
      );
    }

    if (leave.type === "annual" || leave.type === "sick") {
      const year = new Date(leave.start_date).getFullYear();
      const days = dateRangeArray(leave.start_date, leave.end_date).length;
      await ensureBalance(leave.user_id, year, leave.type, days, client);
      await deductBalance(leave.user_id, year, leave.type, days, client);
    }
  });
  return { userId: userId! };
}
