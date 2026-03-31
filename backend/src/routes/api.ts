import { Router } from "express";
import { filecoinService } from "../services/filecoin";
import { lighthouseService } from "../services/lighthouse";

const router = Router();

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

export default router;
