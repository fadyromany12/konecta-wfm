import { query } from "../../db/pool";
import type { PoolClient } from "pg";

export interface OpenShift {
  id: string;
  location_id: string | null;
  date: string;
  shift_start: string;
  shift_end: string;
  role_or_title: string | null;
  notes: string | null;
  posted_by: string | null;
  claimed_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function listOpen(from: string, to: string, client?: PoolClient) {
  const { rows } = await query(
    "SELECT id, location_id, date, shift_start::text, shift_end::text, role_or_title, notes, posted_by, claimed_by, status, created_at, updated_at FROM open_shifts WHERE status = 'open' AND date >= $1 AND date <= $2 ORDER BY date, shift_start",
    [from, to],
    client,
  );
  return rows as OpenShift[];
}

export async function getById(id: string, client?: PoolClient) {
  const { rows } = await query("SELECT * FROM open_shifts WHERE id = $1", [id], client);
  return (rows[0] as OpenShift) || null;
}

export async function create(params: {
  location_id?: string | null;
  date: string;
  shift_start: string;
  shift_end: string;
  role_or_title?: string | null;
  notes?: string | null;
  posted_by: string;
}, client?: PoolClient) {
  const { rows } = await query(
    "INSERT INTO open_shifts (location_id, date, shift_start, shift_end, role_or_title, notes, posted_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING *",
    [params.location_id ?? null, params.date, params.shift_start, params.shift_end, params.role_or_title ?? null, params.notes ?? null, params.posted_by],
    client,
  );
  return rows[0] as OpenShift;
}

export async function claim(shiftId: string, userId: string, client?: PoolClient) {
  const { rows } = await query(
    "UPDATE open_shifts SET claimed_by = $2, status = 'claimed', updated_at = now() WHERE id = $1 AND status = 'open' RETURNING *",
    [shiftId, userId],
    client,
  );
  return (rows[0] as OpenShift) || null;
}

export async function cancel(shiftId: string, client?: PoolClient) {
  const { rowCount } = await query("UPDATE open_shifts SET status = 'cancelled', updated_at = now() WHERE id = $1", [shiftId], client);
  return (rowCount ?? 0) > 0;
}

export async function listMyClaims(userId: string, from: string, to: string, client?: PoolClient) {
  const { rows } = await query(
    "SELECT id, location_id, date, shift_start::text, shift_end::text, role_or_title, notes, posted_by, claimed_by, status, created_at, updated_at FROM open_shifts WHERE claimed_by = $1 AND date >= $2 AND date <= $3 ORDER BY date",
    [userId, from, to],
    client,
  );
  return rows as OpenShift[];
}
