import { getScheduleByUser } from "./repository";
import type { ScheduleRow } from "./repository";

export async function getScheduleForUser(userId: string, from: string, to: string): Promise<ScheduleRow[]> {
  return getScheduleByUser(userId, from, to);
}
