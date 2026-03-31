import { Router } from "express";
import { filecoinService } from "../services/filecoin";
import { lighthouseService } from "../services/lighthouse";

const router = Router();

// Agent registry
router.get("/agents", async (_req, res) => {
  try {
    const agents = ["Eric", "Harper", "Rishi", "Yasmin"];
    const agentData = await Promise.all(
      agents.map(async (name) => {
        const agentId = await filecoinService.getAgentByName(name);
        const uri = await filecoinService.getAgentURI(Number(agentId));
        return { name, agentId: Number(agentId), uri };
      })
    );
    res.json({ agents: agentData });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/agents/:agentId/verify", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const verified = await filecoinService.verifyAgent(agentId);
    res.json({ agentId, verified });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/agents/:name/status", async (req, res) => {
  try {
    const { name } = req.params;
    const agentId = await filecoinService.getAgentByName(name);
    const verified = await filecoinService.verifyAgent(Number(agentId));
    res.json({ name, agentId: Number(agentId), verified, status: "ready" });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Storage
router.post("/storage/upload", async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "data required" });
    const cid = await lighthouseService.upload(typeof data === "string" ? data : JSON.stringify(data));
    res.json({ cid, url: lighthouseService.getGatewayUrl(cid) });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Session management (in-memory; use Redis/DB in production)
const sessions = new Map<string, { walletAddress: string; createdAt: string; history: unknown[] }>();

router.post("/session", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessions.set(sessionId, {
      walletAddress: walletAddress || "",
      createdAt: new Date().toISOString(),
      history: [],
    });
    res.status(201).json({ sessionId, walletAddress });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({ sessionId, status: "active", ...session });
});

router.get("/session/:sessionId/history", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    res.json({ sessionId, history: session?.history ?? [] });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Proofs (Filecoin/IPFS via Lighthouse)
router.get("/proofs/:cid", async (req, res) => {
  try {
    const { cid } = req.params;
    const data = await lighthouseService.getFile(cid);
    res.json({ cid, data });
  } catch (error: unknown) {
    res.status(404).json({ error: "Proof not found" });
  }
});

export default router;
