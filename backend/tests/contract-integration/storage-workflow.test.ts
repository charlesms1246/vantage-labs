// Mock Lighthouse since no real API key
jest.mock("@lighthouse-web3/sdk", () => ({
  __esModule: true,
  default: {
    uploadText: jest.fn().mockImplementation(async (data: string, apiKey: string) => {
      // Simulate a real CID format
      const hash = Buffer.from(data.slice(0, 32)).toString("hex");
      return { data: { Hash: `QmIntegration${hash.slice(0, 8)}` } };
    }),
  },
}));

import { lighthouseService } from "../../src/services/lighthouse";

describe("Filecoin Storage Integration (Lighthouse)", () => {
  describe("Document Storage via lighthouseService", () => {
    it("should upload market analysis and return a CID", async () => {
      const analysis = {
        type: "market_analysis",
        token: "FLOW",
        timestamp: new Date().toISOString(),
        recommendation: "HOLD",
        confidence: 0.75,
        analyst: "Eric",
      };

      const cid = await lighthouseService.upload(JSON.stringify(analysis));
      expect(typeof cid).toBe("string");
      expect(cid.length).toBeGreaterThan(0);
    });

    it("should upload session log and return a CID", async () => {
      const sessionLog = {
        sessionId: "integration-test-session",
        timestamp: new Date().toISOString(),
        agents: ["Orchestrator", "Eric", "Harper"],
        tasks: [
          { agent: "Eric", action: "analyze_market", status: "complete" },
          { agent: "Harper", action: "execute_trade", status: "complete" },
        ],
        result: "success",
      };

      const cid = await lighthouseService.upload(JSON.stringify(sessionLog));
      expect(typeof cid).toBe("string");
      expect(cid.length).toBeGreaterThan(0);
      console.log(`Session log stored at: ipfs://${cid}`);
    });

    it("should upload NFT metadata and return a CID", async () => {
      const metadata = {
        name: "Vantage Genesis #1",
        description: "A generative DeFi artwork by Yasmin",
        image: "ipfs://QmSampleImage",
        attributes: [{ trait_type: "Chain", value: "Flow EVM" }],
        created_by: "Yasmin - Vantage Labs",
      };

      const cid = await lighthouseService.upload(JSON.stringify(metadata));
      expect(typeof cid).toBe("string");
    });

    it("should generate correct gateway URL for CID", () => {
      const cid = "QmTestCID123";
      const url = lighthouseService.getGatewayUrl(cid);
      expect(url).toBe(`https://gateway.lighthouse.storage/ipfs/${cid}`);
    });
  });
});
