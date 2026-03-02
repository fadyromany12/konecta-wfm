import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type Role = "agent" | "manager" | "admin" | "project_manager" | "rta";

export interface AuthPayload {
  sub: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

function getToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.split(" ")[1];
  const q = req.query as { token?: string };
  return q.token && typeof q.token === "string" ? q.token : null;
}

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: { message: "Missing authorization header" } });
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: { message: "Invalid or expired token" } });
  }
}

export function requireRole(roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }
    return next();
  };
}

