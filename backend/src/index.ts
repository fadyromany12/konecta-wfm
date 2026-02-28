import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import authRoutes from "./modules/auth/routes";
import attendanceRoutes from "./modules/attendance/routes";
import auxRoutes from "./modules/auxlogs/routes";
import leaveRoutes from "./modules/leave/routes";
import schedulesRoutes from "./modules/schedules/routes";
import shiftSwapRoutes from "./modules/shiftSwap/routes";
import usersRoutes from "./modules/users/routes";
import managerRoutes from "./modules/manager/routes";
import adminRoutes from "./modules/admin/routes";
import uploadRoutes from "./modules/upload/routes";
import notificationsRoutes from "./modules/notifications/routes";
import holidaysRoutes from "./modules/holidays/routes";
import departmentsRoutes from "./modules/departments/routes";
import announcementsRoutes from "./modules/announcements/routes";

const app = express();

app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);

app.get("/", (_req, res) => {
  res.json({ message: "Konecta WFM API", health: "http://localhost:4000/health" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/auth/check", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/aux", auxRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/schedules", schedulesRoutes);
app.use("/api/shift-swaps", shiftSwapRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/holidays", holidaysRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/announcements", announcementsRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: { message: "Server error" } });
});

const PORT = env.port;

app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`API server running on http://localhost:${PORT}`);
});

