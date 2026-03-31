import { ethers } from "ethers";

const FILECOIN_RPC = "https://api.calibration.node.glif.io/rpc/v1";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

const filecoinAddresses = {
  IdentityRegistry: "0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D",
  ReputationRegistry: "0x558298297E714312D5670dBe4dbc15E1D240a811",
  VantageAgentRegistry: "0x7Bbfb48BCEDF4B562fAB3cFdcb5974bf7cACd290",
};

const IdentityRegistryABI = require("../../contracts/abis/IdentityRegistry.json");
const VantageRegistryABI = require("../../contracts/abis/VantageAgentRegistry.json");

describe("Agent Registration Integration (Filecoin Calibnet)", () => {
  let provider: ethers.JsonRpcProvider;
  let wallet: ethers.Wallet;
  let identityRegistry: ethers.Contract;
  let vantageRegistry: ethers.Contract;

  beforeAll(async () => {
    provider = new ethers.JsonRpcProvider(FILECOIN_RPC);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    identityRegistry = new ethers.Contract(filecoinAddresses.IdentityRegistry, IdentityRegistryABI, wallet);
    vantageRegistry = new ethers.Contract(filecoinAddresses.VantageAgentRegistry, VantageRegistryABI, wallet);
  });

  describe("Pre-registered Vantage Agents", () => {
    it("should verify Eric is registered on-chain", async () => {
      const ericId = await vantageRegistry.getAgentByName("Eric");
      expect(Number(ericId)).toBeGreaterThan(0);
      const isVantage = await vantageRegistry.isVantageAgent(ericId);
      expect(isVantage).toBe(true);
      const role = await vantageRegistry.getAgentRole(ericId);
      expect(role).toBe("market_analyst");
    });

    it("should verify all four agents are registered", async () => {
      const agents = ["Eric", "Harper", "Rishi", "Yasmin"];
      for (const name of agents) {
        const agentId = await vantageRegistry.getAgentByName(name);
        expect(Number(agentId)).toBeGreaterThan(0);
        const uri = await identityRegistry.tokenURI(agentId);
        expect(uri).toMatch(/^ipfs:\/\//);
      }
    });

    it("should return correct models for agents", async () => {
      const ericId = await vantageRegistry.getAgentByName("Eric");
      const harperId = await vantageRegistry.getAgentByName("Harper");
      const rishiId = await vantageRegistry.getAgentByName("Rishi");

      const ericModel = await vantageRegistry.getAgentModel(ericId);
      const harperModel = await vantageRegistry.getAgentModel(harperId);
      const rishiModel = await vantageRegistry.getAgentModel(rishiId);

      expect(ericModel).toBe("gemini");
      expect(harperModel).toBe("groq-llama");
      expect(rishiModel).toBe("claude-3.5-sonnet");
    });
  });

  describe("Agent Identity Workflow", () => {
    it("should register a new test agent with simulated Filecoin URI", async () => {
      // Simulate Lighthouse CID (since no real Lighthouse key)
      const simulatedCID = "QmTestIntegrationAgent" + Date.now();
      const agentURI = `ipfs://${simulatedCID}`;

      const tx = await identityRegistry.register(agentURI);
      const receipt = await tx.wait();
      expect(receipt.status).toBe(1);

      // Find Registered event
      const filter = identityRegistry.filters.Registered();
      const events = await identityRegistry.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);
      expect(events.length).toBeGreaterThan(0);
    });

    it("should set and retrieve metadata for a registered agent", async () => {
      // Get the latest agentId registered by the deployer wallet
      const filter = identityRegistry.filters.Registered(null, wallet.address);
      const events = await identityRegistry.queryFilter(filter);

      if (events.length === 0) {
        console.log("No agents registered by deployer, skipping metadata test");
        return;
      }

      const latestEvent = events[events.length - 1] as any;
      const agentId = latestEvent.args.agentId;

      const key = "integration_test";
      const value = ethers.toUtf8Bytes("phase7_test_value");

      const tx = await identityRegistry.setMetadata(agentId, key, value);
      await tx.wait();

      const retrieved = await identityRegistry.getMetadata(agentId, key);
      expect(ethers.toUtf8String(retrieved)).toBe("phase7_test_value");
    });
  });

  describe("filecoinService integration", () => {
    it("should verify agents via filecoinService", async () => {
      const { filecoinService } = require("../../src/services/filecoin");
      const verified = await filecoinService.verifyAgent(1);
      expect(verified).toBe(true);
    });

    it("should get agent URI via filecoinService", async () => {
      const { filecoinService } = require("../../src/services/filecoin");
      const uri = await filecoinService.getAgentURI(1);
      expect(uri).toMatch(/^ipfs:\/\//);
    });

    it("should get agent by name via filecoinService", async () => {
      const { filecoinService } = require("../../src/services/filecoin");
      const agentId = await filecoinService.getAgentByName("Harper");
      expect(typeof agentId).toBe("bigint");
      expect(agentId).toBe(2n);
    });
  });
});
