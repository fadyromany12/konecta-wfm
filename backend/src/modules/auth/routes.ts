import { Router } from "express";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from "./schemas";
import { loginUser, registerUser, verifyEmailToken, forgotPassword, resetPasswordWithToken, changePassword } from "./service";
import { logAudit } from "../../lib/audit";
import { getManagers } from "../users/userRepository";
import { authenticateJWT, AuthRequest } from "../../middleware/auth";

const router = Router();

router.get("/managers", async (_req, res) => {
  try {
    const list = await getManagers();
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/register", async (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  try {
    const user = await registerUser({
      firstName: parseResult.data.firstName,
      lastName: parseResult.data.lastName,
      email: parseResult.data.email,
      password: parseResult.data.password,
      managerId: parseResult.data.managerId ?? null,
    });
    return res.status(201).json({
      message: "Registration submitted. Your manager and admin will approve your account. You can log in to see status.",
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Registration failed" } });
  }
});

router.post("/login", async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  try {
    const result = await loginUser(parseResult.data);
    const { user, token, pendingApproval } = result;
    await logAudit("login", user.id, { email: user.email, pendingApproval: !!pendingApproval }, req.ip);
    return res.json({
      token,
      pendingApproval: pendingApproval ?? false,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        force_password_change: user.force_password_change,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err?.message || err);
    return res.status(400).json({ error: { message: err?.message || "Login failed" } });
  }
});

router.post("/forgot-password", async (req, res) => {
  const parseResult = forgotPasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const result = await forgotPassword(parseResult.data.email);
  return res.json({
    message: "If that account exists, your manager or admin will set a temporary password for you. Contact them or check back after they approve.",
    ...(result && { requested: result.requested }),
  });
});

router.post("/change-password", authenticateJWT, async (req: AuthRequest, res) => {
  const parseResult = changePasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  try {
    await changePassword(req.user!.sub, parseResult.data.currentPassword, parseResult.data.newPassword);
    return res.json({ message: "Password updated." });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Change password failed" } });
  }
});

router.post("/reset-password", async (req, res) => {
  const parseResult = resetPasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  try {
    await resetPasswordWithToken(parseResult.data.token, parseResult.data.newPassword);
    return res.json({ message: "Password has been reset. You can log in now." });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Reset failed" } });
  }
});

router.get("/verify-email", async (req, res) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    return res.status(400).json({ error: { message: "Missing token" } });
  }
  try {
    await verifyEmailToken(token);
    return res.json({ message: "Email verified successfully. You can now log in." });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Verification failed" } });
  }
});

export default router;

