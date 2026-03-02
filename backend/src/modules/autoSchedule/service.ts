import { query } from "../../db/pool";
import { getWindowsByUser } from "../availability/repository";
import { getNumeric } from "../laborRules/repository";

export interface SuggestedShift {
  user_id: string;
  date: string;
  shift_start: string;
  shift_end: string;
  day_type: string;
}

/** Minimal auto-scheduler: suggests shifts for agents in date range using availability and labor rules. */
export async function suggestShifts(
  from: string,
  to: string,
  userIds?: string[],
): Promise<{ suggested: SuggestedShift[]; message: string }> {
  const dailyMax = await getNumeric("daily_max_hours", 12);
  const weeklyMax = await getNumeric("weekly_max_hours", 48);

  let agentsSql = "SELECT id FROM users WHERE status = 'active' AND role = 'agent'";
  const agentParams: unknown[] = [];
  if (userIds?.length) {
    agentsSql += " AND id = ANY($1::uuid[])";
    agentParams.push(userIds);
  }
  const { rows: agents } = await query<{ id: string }>(agentsSql, agentParams);

  const suggested: SuggestedShift[] = [];
  const fromD = new Date(from + "T12:00:00");
  const toD = new Date(to + "T12:00:00");

  for (const a of agents) {
    const windows = await getWindowsByUser(a.id);
    const weekStart = new Date(fromD);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    let weekHours = 0;
    const d = new Date(fromD);
    while (d <= toD) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      const win = windows.find((w) => w.day_of_week === dayOfWeek);
      if (win && weekHours < weeklyMax) {
        const start = dateStr + "T" + win.start_time.slice(0, 8);
        const end = dateStr + "T" + win.end_time.slice(0, 8);
        const hours = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
        if (hours <= dailyMax && weekHours + hours <= weeklyMax) {
          suggested.push({
            user_id: a.id,
            date: dateStr,
            shift_start: start,
            shift_end: end,
            day_type: "work",
          });
          weekHours += hours;
        }
      }
      d.setDate(d.getDate() + 1);
    }
  }

  return {
    suggested,
    message: suggested.length > 0 ? `Suggested ${suggested.length} shift(s) from availability and labor rules.` : "No suggestions (add availability windows for agents).",
  };
}
