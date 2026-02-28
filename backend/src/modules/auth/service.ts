import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import {
  CreateUserInput,
  User,
  createUser,
  findUserByEmail,
  markEmailVerified,
  updatePassword,
} from "../users/userRepository";
import { createResetToken, consumeResetToken } from "./passwordResetRepository";
import { createVerificationToken, consumeVerificationToken } from "./emailVerificationRepository";
import { sendVerificationEmail, sendPasswordResetEmail } from "../../lib/email";

const BCRYPT_ROUNDS = 10;

export async function registerUser(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
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
  };
  const user = await createUser(input);
  const token = await createVerificationToken(user.id);
  const verificationLink = `${env.frontendOrigin}/verify-email?token=${encodeURIComponent(token)}`;
  await sendVerificationEmail(data.email, verificationLink);
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
}): Promise<{ user: User; token: string }> {
  const user = await findUserByEmail(data.email);
  if (!user) {
    throw new Error("Invalid credentials");
  }
  const match = await bcrypt.compare(data.password, user.password_hash);
  if (!match) {
    throw new Error("Invalid credentials");
  }

  if (!user.is_email_verified) {
    throw new Error("Email not verified");
  }

  if (env.adminApprovalRequired && !user.is_approved) {
    throw new Error("Account pending admin approval");
  }

  const token = generateJwtToken(user);
  return { user, token };
}

export async function verifyEmailToken(token: string): Promise<void> {
  const userId = await consumeVerificationToken(token);
  if (!userId) throw new Error("Invalid or expired verification link");
  await markEmailVerified(userId);
}

export async function forgotPassword(email: string): Promise<{ token: string } | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const token = await createResetToken(user.id);
  const resetLink = `${env.frontendOrigin}/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail(email, resetLink);
  return { token };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const userId = await consumeResetToken(token);
  if (!userId) throw new Error("Invalid or expired reset token");
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updatePassword(userId, passwordHash);
}

