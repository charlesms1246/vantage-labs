import { Router } from "express";
import { filecoinProvider, flowProvider } from "../config/chains";

const router = Router();

router.get("/", async (_req, res) => {
  const checks = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      filecoin: "unknown",
      flow: "unknown",
    },
  };

  try {
    await filecoinProvider.getBlockNumber();
    checks.services.filecoin = "ok";
  } catch {
    checks.services.filecoin = "error";
  }

  try {
    await flowProvider.getBlockNumber();
    checks.services.flow = "ok";
  } catch {
    checks.services.flow = "error";
  }

  res.json(checks);
});

export default router;
