import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: String(process.env.JWT_EXPIRES_IN || "3600"),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  adminApprovalRequired: (process.env.ADMIN_APPROVAL_REQUIRED || "true") === "true",
  // Email (optional – if not set, verification link is logged to console)
  smtpHost: process.env.EMAIL_SMTP_HOST || "",
  smtpPort: Number(process.env.EMAIL_SMTP_PORT || 587),
  smtpUser: process.env.EMAIL_SMTP_USER || "",
  smtpPass: process.env.EMAIL_SMTP_PASS || "",
  mailFrom: process.env.EMAIL_FROM || "noreply@konecta.com",
};

