import { Request, Response, NextFunction } from "express";

/**
 * Global error handler. Intercepts errors passed by asyncHandler (or thrown in sync handlers).
 * Returns standardized JSON: { error: { message: string } } with appropriate status code.
 */
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;
  console.error("Unhandled error:", err);
  const status = err?.status ?? err?.statusCode ?? 500;
  const message = err instanceof Error ? err.message : "Server error";
  res.status(status).json({ error: { message } });
}
