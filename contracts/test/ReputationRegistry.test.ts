import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullSystemFixture } from "./fixtures/deployFixture";

describe("ReputationRegistry", function () {
  // ─── initialize() ──────────────────────────────────────────────────────────

  describe("initialize()", function () {
    it("should revert on re-initialization", async function () {
      const { reputationRegistry, identityRegistry } = await loadFixture(deployFullSystemFixture);
      await expect(
        reputationRegistry.initialize(await identityRegistry.getAddress())
      ).to.be.revertedWith("ReputationRegistry: already initialized");
    });

    it("should revert with zero address", async function () {
      const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
      const fresh = await ReputationRegistry.deploy();
      await expect(fresh.initialize(ethers.ZeroAddress)).to.be.revertedWith(
        "ReputationRegistry: zero address"
      );
    });

    it("should revert if called by non-owner", async function () {
      const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
      const fresh = await ReputationRegistry.deploy();
      const [, addr1, , addr2] = await ethers.getSigners();
      // addr1 is not owner
      await expect(
        fresh.connect(addr1).initialize(addr2.address)
      ).to.be.revertedWithCustomError(fresh, "OwnableUnauthorizedAccount");
    });

    it("getIdentityRegistry() returns correct address after init", async function () {
      const { reputationRegistry, identityRegistry } = await loadFixture(deployFullSystemFixture);
      expect(await reputationRegistry.getIdentityRegistry()).to.equal(
        await identityRegistry.getAddress()
      );
    });
  });

  // ─── giveFeedback() ────────────────────────────────────────────────────────

  describe("giveFeedback()", function () {
    async function setupWithAgent() {
      const fixtures = await loadFixture(deployFullSystemFixture);
      const { identityRegistry, addr1 } = fixtures;
      // Register an agent owned by addr1
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      return { ...fixtures, agentId: 1n };
    }

    it("should store feedback correctly", async function () {
      const { reputationRegistry, addr2, agentId } = await setupWithAgent();
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(agentId, 95, 2, "quality", "speed", "api.vantage.io", "ipfs://fb1", ethers.ZeroHash);
      const fb = await reputationRegistry.getFeedback(agentId, addr2.address, 0);
      expect(fb.value).to.equal(95);
      expect(fb.valueDecimals).to.equal(2);
      expect(fb.tag1).to.equal("quality");
      expect(fb.tag2).to.equal("speed");
      expect(fb.endpoint).to.equal("api.vantage.io");
      expect(fb.feedbackURI).to.equal("ipfs://fb1");
      expect(fb.client).to.equal(addr2.address);
    });

    it("should emit NewFeedback event", async function () {
      const { reputationRegistry, addr2, agentId } = await setupWithAgent();
      await expect(
        reputationRegistry
          .connect(addr2)
          .giveFeedback(agentId, 80, 0, "t1", "t2", "endpoint", "uri", ethers.ZeroHash)
      )
        .to.emit(reputationRegistry, "NewFeedback")
        .withArgs(agentId, addr2.address, 80, 0, "t1", "t2", "endpoint", "uri", ethers.ZeroHash);
    });

    it("should revert if agent owner gives self-feedback", async function () {
      const { reputationRegistry, addr1, agentId } = await setupWithAgent();
      await expect(
        reputationRegistry
          .connect(addr1)
          .giveFeedback(agentId, 100, 0, "", "", "", "", ethers.ZeroHash)
      ).to.be.revertedWith("ReputationRegistry: cannot self-feedback");
    });

    it("should revert if not initialized", async function () {
      const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
      const fresh = await ReputationRegistry.deploy();
      const [, addr1] = await ethers.getSigners();
      await expect(
        fresh
          .connect(addr1)
          .giveFeedback(1n, 50, 0, "", "", "", "", ethers.ZeroHash)
      ).to.be.revertedWith("ReputationRegistry: not initialized");
    });

    it("should handle negative feedback values", async function () {
      const { reputationRegistry, addr2, agentId } = await setupWithAgent();
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(agentId, -50, 2, "neg", "", "", "", ethers.ZeroHash);
      const fb = await reputationRegistry.getFeedback(agentId, addr2.address, 0);
      expect(fb.value).to.equal(-50);
    });

    it("should handle zero value feedback", async function () {
      const { reputationRegistry, addr2, agentId } = await setupWithAgent();
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(agentId, 0, 0, "", "", "", "", ethers.ZeroHash);
      const fb = await reputationRegistry.getFeedback(agentId, addr2.address, 0);
      expect(fb.value).to.equal(0);
    });

    it("should handle max int128 value", async function () {
      const { reputationRegistry, addr2, agentId } = await setupWithAgent();
      const maxInt128 = (2n ** 127n) - 1n;
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(agentId, maxInt128, 0, "", "", "", "", ethers.ZeroHash);
      const fb = await reputationRegistry.getFeedback(agentId, addr2.address, 0);
      expect(fb.value).to.equal(maxInt128);
    });

    it("should allow multiple feedbacks from same client", async function () {
      const { reputationRegistry, addr2, agentId } = await setupWithAgent();
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(agentId, 90, 0, "a", "b", "", "", ethers.ZeroHash);
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(agentId, 80, 0, "c", "d", "", "", ethers.ZeroHash);
      expect(await reputationRegistry.getFeedbackCount(agentId, addr2.address)).to.equal(2n);
    });

    it("should store correct timestamp", async function () {
      const { reputationRegistry, addr2, agentId } = await setupWithAgent();
      const before = BigInt(await time.latest());
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(agentId, 50, 0, "", "", "", "", ethers.ZeroHash);
      const fb = await reputationRegistry.getFeedback(agentId, addr2.address, 0);
      const after = BigInt(await time.latest());
      expect(fb.timestamp).to.be.gte(before);
      expect(fb.timestamp).to.be.lte(after);
    });

    it("should allow feedback from multiple clients on same agent", async function () {
      const { reputationRegistry, owner, addr2, agentId } = await setupWithAgent();
      // owner is not addr1 (the agent owner)
      await reputationRegistry
        .connect(owner)
        .giveFeedback(agentId, 70, 0, "", "", "", "", ethers.ZeroHash);
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(agentId, 80, 0, "", "", "", "", ethers.ZeroHash);
      expect(await reputationRegistry.getFeedbackCount(agentId, owner.address)).to.equal(1n);
      expect(await reputationRegistry.getFeedbackCount(agentId, addr2.address)).to.equal(1n);
    });
  });

  // ─── getFeedback() ─────────────────────────────────────────────────────────

  describe("getFeedback()", function () {
    it("should revert for out-of-range index", async function () {
      const { reputationRegistry, identityRegistry, addr1, addr2 } =
        await loadFixture(deployFullSystemFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      await expect(
        reputationRegistry.getFeedback(1n, addr2.address, 0)
      ).to.be.revertedWith("ReputationRegistry: feedback index out of range");
    });

    it("should revert if not initialized", async function () {
      const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
      const fresh = await ReputationRegistry.deploy();
      const [, , addr2] = await ethers.getSigners();
      await expect(fresh.getFeedback(1n, addr2.address, 0)).to.be.revertedWith(
        "ReputationRegistry: not initialized"
      );
    });
  });

  // ─── getFeedbackCount() ────────────────────────────────────────────────────

  describe("getFeedbackCount()", function () {
    it("should return 0 for address with no feedback", async function () {
      const { reputationRegistry, identityRegistry, addr1, addr2 } =
        await loadFixture(deployFullSystemFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      expect(await reputationRegistry.getFeedbackCount(1n, addr2.address)).to.equal(0n);
    });

    it("should increment count after each feedback", async function () {
      const fixtures = await loadFixture(deployFullSystemFixture);
      const { reputationRegistry, identityRegistry, addr1, addr2 } = fixtures;
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      expect(await reputationRegistry.getFeedbackCount(1n, addr2.address)).to.equal(0n);
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(1n, 50, 0, "", "", "", "", ethers.ZeroHash);
      expect(await reputationRegistry.getFeedbackCount(1n, addr2.address)).to.equal(1n);
      await reputationRegistry
        .connect(addr2)
        .giveFeedback(1n, 60, 0, "", "", "", "", ethers.ZeroHash);
      expect(await reputationRegistry.getFeedbackCount(1n, addr2.address)).to.equal(2n);
    });
  });
});
