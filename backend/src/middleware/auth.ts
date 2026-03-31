import { Request, Response, NextFunction } from "express";

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  // Privy auth integration point — for now, pass-through
  // In Phase 9 this will validate Privy JWT tokens
  const walletAddress = req.headers["x-wallet-address"] as string;
  if (walletAddress) (req as any).walletAddress = walletAddress;
  next();
}
