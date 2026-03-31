import { ethers } from "ethers";

const FILECOIN_RPC = "https://api.calibration.node.glif.io/rpc/v1";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

const ReputationRegistryABI = require("../../contracts/abis/ReputationRegistry.json");
const VantageRegistryABI = require("../../contracts/abis/VantageAgentRegistry.json");
const IdentityRegistryABI = require("../../contracts/abis/IdentityRegistry.json");

describe("Reputation System Integration (Filecoin Calibnet)", () => {
  let provider: ethers.JsonRpcProvider;
  let wallet: ethers.Wallet;
  let reputationRegistry: ethers.Contract;
  let vantageRegistry: ethers.Contract;
  let identityRegistry: ethers.Contract;

  beforeAll(async () => {
    provider = new ethers.JsonRpcProvider(FILECOIN_RPC, { chainId: 314159, name: "filecoin-calibration" }, { staticNetwork: true });
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    reputationRegistry = new ethers.Contract(
      "0x558298297E714312D5670dBe4dbc15E1D240a811",
      ReputationRegistryABI,
      wallet
    );
    vantageRegistry = new ethers.Contract(
      "0x7Bbfb48BCEDF4B562fAB3cFdcb5974bf7cACd290",
      VantageRegistryABI,
      wallet
    );
    identityRegistry = new ethers.Contract(
      "0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D",
      IdentityRegistryABI,
      wallet
    );
  });

  describe("Feedback Workflow", () => {
    it("should give feedback to Eric (owned by VantageAgentRegistry, not deployer)", async () => {
      // Eric's token is owned by the VantageAgentRegistry contract, NOT the deployer
      // So the deployer CAN give feedback
      const ericId = await vantageRegistry.getAgentByName("Eric");
      const tokenOwner = await identityRegistry.ownerOf(ericId);
      expect(tokenOwner.toLowerCase()).not.toBe(wallet.address.toLowerCase());

      const tx = await reputationRegistry.giveFeedback(
        ericId,
        90,
        0,
        "accuracy",
        "helpful",
        "",
        "",
        ethers.ZeroHash
      );
      const receipt = await tx.wait();
      expect(receipt.status).toBe(1);
    });

    it("should retrieve feedback count after giving feedback", async () => {
      const ericId = await vantageRegistry.getAgentByName("Eric");
      const count = await reputationRegistry.getFeedbackCount(ericId, wallet.address);
      expect(Number(count)).toBeGreaterThan(0);
    });

    it("should retrieve feedback data correctly", async () => {
      const ericId = await vantageRegistry.getAgentByName("Eric");
      const count = await reputationRegistry.getFeedbackCount(ericId, wallet.address);

      if (Number(count) > 0) {
        const feedback = await reputationRegistry.getFeedback(ericId, wallet.address, 0);
        expect(feedback.client).toBe(wallet.address);
        expect(Number(feedback.value)).toBeGreaterThan(0);
      }
    });

    it("should reject self-feedback (owner giving feedback to own agent)", async () => {
      // Register an agent as deployer wallet, then try to give self-feedback
      const identity = new ethers.Contract(
        "0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D",
        IdentityRegistryABI,
        wallet
      );
      const tx = await identity.register("ipfs://QmSelfFeedbackTestAgent");
      const receipt = await tx.wait();

      // Get the newly registered agentId from events
      const filter = identity.filters.Registered(null, wallet.address);
      const events = await identity.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);
      const agentId = (events[0] as any).args.agentId;

      // Now try self-feedback — should revert
      await expect(
        reputationRegistry.giveFeedback(agentId, 100, 0, "test", "", "", "", ethers.ZeroHash)
      ).rejects.toThrow();
    });

    it("should query NewFeedback events", async () => {
      const ericId = await vantageRegistry.getAgentByName("Eric");
      const filter = reputationRegistry.filters.NewFeedback(ericId);
      // Limit block range to avoid RPC lookback restriction (Filecoin Calibnet: max 16h40m lookback)
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 500);
      const events = await reputationRegistry.queryFilter(filter, fromBlock, latestBlock);
      expect(events.length).toBeGreaterThan(0);
    });
  });
});
