import {
  getTransferRequestsMine,
  getTransferRequestsAll,
  getTransferRequestsByFromManager,
  getTransferRequestsPending,
  getTransferRequestsPendingByManager,
  getTransferRequestById,
  getManagerIdByUserId,
  updateUserManagerId,
  approveTransferRequest,
  rejectTransferRequest,
  getTransferRequestFromManager,
  getTeamWithManager,
  getTeamWithManagerAll,
  getUsersForOrgTree,
  getPendingApprovals,
  getUserForApprove,
  getUserName,
  getPasswordResetRequests,
  getUserByManager,
  getManagersList,
  getAgentByManager,
  getManagerOrAdmin,
  createTransferRequest,
  getTeamSummaryAux,
  getTeamSummaryLeave,
  getTeamAuxToday,
  getTeamPaginated,
  getTeamCount,
  getTeamAttendance,
  getLeavePending,
  getLeaveTeam,
  getLeaveRequestForReject,
  rejectLeaveRequest,
  createScheduleActivity,
  getUserByManager as checkUserByManager,
  getAttendanceByIdAndManager,
  updateAttendancePunch,
  insertAttendanceManual,
  getExportAttendance,
  getExportLeave,
  getExportAux,
  getManagerNotes,
  createManagerNote,
  getDisciplinary,
  createDisciplinary,
  getAttendanceScores,
  getAlerts,
  resolveAlert,
} from "./repository";
import { runInTransaction } from "../../db/pool";

export const managerRepository = {
  getTransferRequestsMine,
  getTransferRequestsAll,
  getTransferRequestsByFromManager,
  getTransferRequestsPending,
  getTransferRequestsPendingByManager,
  getTransferRequestById,
  getManagerIdByUserId,
  updateUserManagerId,
  approveTransferRequest,
  rejectTransferRequest,
  getTransferRequestFromManager,
  getTeamWithManager,
  getTeamWithManagerAll,
  getUsersForOrgTree,
  getPendingApprovals,
  getUserForApprove,
  getUserName,
  getPasswordResetRequests,
  getUserByManager,
  getManagersList,
  getAgentByManager,
  getManagerOrAdmin,
  createTransferRequest,
  getTeamSummaryAux,
  getTeamSummaryLeave,
  getTeamAuxToday,
  getTeamPaginated,
  getTeamCount,
  getTeamAttendance,
  getLeavePending,
  getLeaveTeam,
  getLeaveRequestForReject,
  rejectLeaveRequest,
  createScheduleActivity,
  checkUserByManager,
  getAttendanceByIdAndManager,
  updateAttendancePunch,
  insertAttendanceManual,
  getExportAttendance,
  getExportLeave,
  getExportAux,
  getManagerNotes,
  createManagerNote,
  getDisciplinary,
  createDisciplinary,
  getAttendanceScores,
  getAlerts,
  resolveAlert,
};

export async function getTransferRequests(userId: string, isAdmin: boolean, filter: string) {
  if (filter === "mine") return getTransferRequestsMine(userId);
  if (filter === "all" || filter === "history") {
    return isAdmin ? getTransferRequestsAll() : getTransferRequestsByFromManager(userId);
  }
  return isAdmin ? getTransferRequestsPending() : getTransferRequestsPendingByManager(userId);
}

export async function approveTransfer(id: string, approverId: string, isAdmin: boolean) {
  const r = await getTransferRequestById(id);
  if (!r) return null;
  const fromManagerId = await getManagerIdByUserId(r.from_manager_id);
  const allowed = isAdmin || fromManagerId === approverId;
  if (!allowed) return null;
  await runInTransaction(async (client) => {
    await updateUserManagerId(r.agent_id, r.to_manager_id, client);
    await approveTransferRequest(id, approverId, client);
  });
  return r;
}

export async function rejectTransfer(id: string, approverId: string, isAdmin: boolean) {
  const r = await getTransferRequestFromManager(id);
  if (!r) return null;
  const fromManagerId = await getManagerIdByUserId(r.from_manager_id);
  const allowed = isAdmin || fromManagerId === approverId;
  if (!allowed) return null;
  await rejectTransferRequest(id, approverId);
  return r;
}

export function buildOrgTree(users: { id: string; manager_id: string | null }[], rootManagerId: string | null) {
  const byManager = new Map<string | null, typeof users>();
  const userIds = new Set(users.map((u) => u.id));
  for (const u of users) {
    const key = u.manager_id ?? null;
    if (!byManager.has(key)) byManager.set(key, []);
    byManager.get(key)!.push(u);
  }
  const build = (managerId: string | null): any[] => {
    const children = byManager.get(managerId) || [];
    return children.map((u) => ({ ...u, children: build(u.id) }));
  };
  let roots = build(rootManagerId);
  if (roots.length === 0 && users.length > 0 && rootManagerId === null) {
    const topLevel = users.filter((u) => !u.manager_id || !userIds.has(u.manager_id));
    roots = topLevel.map((u) => ({ ...u, children: build(u.id) }));
  }
  return roots;
}

export async function createTransfer(agentId: string, fromManagerId: string, toManagerId: string) {
  const agent = await getAgentByManager(agentId, fromManagerId);
  if (!agent) return null;
  const toM = await getManagerOrAdmin(toManagerId);
  if (!toM) return null;
  return createTransferRequest(agentId, fromManagerId, toManagerId);
}

export async function getTeamSummary(managerId: string, from: string, to: string) {
  const [auxRows, leaveRows] = await Promise.all([
    getTeamSummaryAux(managerId, from, to),
    getTeamSummaryLeave(managerId, from, to),
  ]);
  const auxCounts: Record<string, number> = {};
  auxRows.forEach((r: any) => { auxCounts[r.aux_type] = Number(r.cnt) || 0; });
  const leaveCounts: Record<string, number> = {};
  leaveRows.forEach((r: any) => { leaveCounts[r.type] = Number(r.cnt) || 0; });
  return { aux: auxCounts, leave: leaveCounts, from, to };
}

export function toDateOnly(v: string | Date | null | undefined): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : (v as Date).toISOString?.() ?? String(v);
  return s.slice(0, 10);
}
