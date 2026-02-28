import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import {
  CreateUserInput,
  User,
  createUser,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  updatePassword,
  setTempPasswordAndForceChange,
  setForcePasswordChange,
} from "../users/userRepository";
import { createResetToken, consumeResetToken } from "./passwordResetRepository";
import { createVerificationToken, consumeVerificationToken } from "./emailVerificationRepository";

const BCRYPT_ROUNDS = 10;

function randomTempPassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function registerUser(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  managerId?: string | null;
}): Promise<User> {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new Error("Email already in use");
  }
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const input: CreateUserInput = {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    passwordHash,
    role: "agent",
    managerId: data.managerId ?? null,
  };
  const user = await createUser(input);
  return user;
}

export function generateJwtToken(user: User): string {
  const payload = {
    sub: user.id,
    role: user.role,
  };
  const expiresInSeconds = Number(env.jwtExpiresIn) || 3600;
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: expiresInSeconds,
  });
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<{ user: User; token: string; pendingApproval?: boolean }> {
  const user = await findUserByEmail(data.email);
  if (!user) {
    throw new Error("Invalid credentials");
  }
  const match = await bcrypt.compare(data.password, user.password_hash);
  if (!match) {
    throw new Error("Invalid credentials");
  }

  if (env.adminApprovalRequired && !user.is_approved) {
    const token = generateJwtToken(user);
    return { user, token, pendingApproval: true };
  }

  const token = generateJwtToken(user);
  return { user, token };
}

export async function verifyEmailToken(token: string): Promise<void> {
  const userId = await consumeVerificationToken(token);
  if (!userId) throw new Error("Invalid or expired verification link");
  await markEmailVerified(userId);
}

export async function forgotPassword(email: string): Promise<{ requested: boolean } | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const { query } = await import("../../db/pool");
  await query(
    `INSERT INTO password_reset_requests (user_id) VALUES ($1)`,
    [user.id],
  );
  return { requested: true };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const userId = await consumeResetToken(token);
  if (!userId) throw new Error("Invalid or expired reset token");
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updatePassword(userId, passwordHash);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) throw new Error("Current password is incorrect");
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updatePassword(userId, passwordHash);
  await setForcePasswordChange(userId, false);
}

export async function approveAgentAndSetTempPassword(userId: string): Promise<{ tempPassword: string }> {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  if (user.role !== "agent") throw new Error("Only agents can be approved this way");
  if (user.is_approved) throw new Error("User already approved");
  const tempPassword = randomTempPassword(10);
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  await setTempPasswordAndForceChange(userId, passwordHash);
  await import("../users/userRepository").then(({ approveUser }) => approveUser(userId));
  return { tempPassword };
}

export async function setTempPasswordForUser(byUserId: string, targetUserId: string): Promise<{ tempPassword: string }> {
  const target = await findUserById(targetUserId);
  if (!target) throw new Error("User not found");
  const tempPassword = randomTempPassword(10);
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  await setTempPasswordAndForceChange(targetUserId, passwordHash);
  const { query } = await import("../../db/pool");
  await query(
    `UPDATE password_reset_requests SET handled_at = now(), handled_by = $2 WHERE user_id = $1 AND handled_at IS NULL`,
    [targetUserId, byUserId],
  );
  return { tempPassword };
}

