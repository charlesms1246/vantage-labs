import { Request, Response, NextFunction } from "express";
import { logger } from "../services/logger";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error("SYSTEM", `Unhandled error: ${err.message}`, { stack: err.stack?.slice(0, 500) });
  res.status(500).json({ error: err.message });
}
