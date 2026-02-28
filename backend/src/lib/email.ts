import nodemailer from "nodemailer";
import { env } from "../config/env";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!env.smtpHost || !env.smtpUser) return null;
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
  return transporter;
}

export async function sendVerificationEmail(to: string, verificationLink: string): Promise<boolean> {
  const transport = getTransporter();
  const html = `
    <p>Please verify your Konecta WFM account by clicking the link below.</p>
    <p><a href="${verificationLink}">Verify my email</a></p>
    <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
  `;
  if (transport) {
    try {
      await transport.sendMail({
        from: env.mailFrom,
        to,
        subject: "Verify your Konecta WFM account",
        html,
      });
      return true;
    } catch (err) {
      console.error("Send verification email failed:", err);
      return false;
    }
  }
  console.log("[Email not configured] Verification link:", verificationLink);
  return true;
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const transport = getTransporter();
  const html = `
    <p>You requested a password reset for Konecta WFM.</p>
    <p><a href="${resetLink}">Reset password</a></p>
    <p>This link expires in 24 hours. If you didn't request this, you can ignore this email.</p>
  `;
  if (transport) {
    try {
      await transport.sendMail({
        from: env.mailFrom,
        to,
        subject: "Reset your Konecta WFM password",
        html,
      });
      return true;
    } catch (err) {
      console.error("Send reset email failed:", err);
      return false;
    }
  }
  console.log("[Email not configured] Reset link:", resetLink);
  return true;
}
