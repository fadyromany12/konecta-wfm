import { Router } from "express";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "./schemas";
import { loginUser, registerUser, verifyEmailToken, forgotPassword, resetPasswordWithToken } from "./service";
import { logAudit } from "../../lib/audit";

const router = Router();

router.post("/register", async (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  try {
    const user = await registerUser(parseResult.data);
    return res.status(201).json({
      message: "Registration successful. Please check your email to activate your account.",
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
    const { user, token } = await loginUser(parseResult.data);
    await logAudit("login", user.id, { email: user.email }, req.ip);
    return res.json({
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
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
    message: "If that email exists, a reset link has been sent.",
    ...(result && { resetToken: result.token }),
  });
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

