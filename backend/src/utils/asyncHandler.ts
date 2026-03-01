import { Request, Response, NextFunction } from "express";

/** Wraps async route handlers so thrown errors and rejected promises are passed to next() and handled by error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
