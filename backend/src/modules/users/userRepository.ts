import { query } from "../../db/pool";

export type UserRole = "agent" | "manager" | "admin";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  manager_id: string | null;
  status: "pending" | "active" | "inactive";
  is_approved: boolean;
  is_email_verified: boolean;
  force_password_change?: boolean;
  created_at: string;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const { rows } = await query<User>(
    `SELECT * FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  return rows[0] || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await query<User>(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] || null;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  managerId?: string | null;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const { rows } = await query<User>(
    `
      INSERT INTO users (first_name, last_name, email, password_hash, role, manager_id, status, is_approved, is_email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', false, true)
      RETURNING *
    `,
    [input.firstName, input.lastName, input.email.toLowerCase(), input.passwordHash, input.role, input.managerId ?? null],
  );
  return rows[0];
}

export async function markEmailVerified(userId: string): Promise<void> {
  await query(`UPDATE users SET is_email_verified = true WHERE id = $1`, [userId]);
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await query(
    `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
    [userId, passwordHash],
  );
}

export async function approveUser(userId: string): Promise<void> {
  await query(
    `UPDATE users SET is_approved = true, status = 'active' WHERE id = $1`,
    [userId],
  );
}

export async function setTempPasswordAndForceChange(userId: string, passwordHash: string): Promise<void> {
  await query(
    `UPDATE users SET password_hash = $2, force_password_change = true, updated_at = now() WHERE id = $1`,
    [userId, passwordHash],
  );
}

export async function setForcePasswordChange(userId: string, value: boolean): Promise<void> {
  await query(
    `UPDATE users SET force_password_change = $2, updated_at = now() WHERE id = $1`,
    [userId, value],
  );
}

export async function getManagers(): Promise<{ id: string; first_name: string; last_name: string; email: string }[]> {
  const { rows } = await query(
    `SELECT id, first_name, last_name, email FROM users WHERE role = 'manager' AND status = 'active' ORDER BY first_name, last_name`,
  );
  return rows;
}

