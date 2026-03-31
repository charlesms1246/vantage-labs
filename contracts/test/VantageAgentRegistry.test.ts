import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullSystemFixture } from "./fixtures/deployFixture";

const AGENTS = [
  { name: "Eric",   role: "market-analyst", model: "claude-3-opus",   uri: "ipfs://eric"   },
  { name: "Harper", role: "trader",         model: "claude-3-sonnet", uri: "ipfs://harper" },
  { name: "Rishi",  role: "developer",      model: "claude-3-haiku",  uri: "ipfs://rishi"  },
  { name: "Yasmin", role: "creative",       model: "claude-3-sonnet", uri: "ipfs://yasmin" },
];

describe("VantageAgentRegistry", function () {
  // ─── constructor ────────────────────────────────────────────────────────────

  describe("constructor", function () {
    it("should revert with zero identity registry address", async function () {
      const VantageAgentRegistry = await ethers.getContractFactory("VantageAgentRegistry");
      await expect(
        VantageAgentRegistry.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("VantageAgentRegistry: zero address");
    });

    it("should store identity registry address", async function () {
      const { vantageRegistry, identityRegistry } = await loadFixture(deployFullSystemFixture);
      expect(await vantageRegistry.getIdentityRegistry()).to.equal(
        await identityRegistry.getAddress()
      );
    });
  });

  // ─── registerVantageAgent() ─────────────────────────────────────────────────

  describe("registerVantageAgent()", function () {
    it("should register all 4 Vantage agents with sequential IDs", async function () {
      const { vantageRegistry } = await loadFixture(deployFullSystemFixture);
      for (let i = 0; i < AGENTS.length; i++) {
        const a = AGENTS[i];
        await expect(
          vantageRegistry.registerVantageAgent(a.name, a.role, a.model, a.uri)
        )
          .to.emit(vantageRegistry, "VantageAgentRegistered")
          .withArgs(BigInt(i + 1), a.name, a.role, a.model, a.uri);
      }
    });

    it("should revert if called by non-owner", async function () {
      const { vantageRegistry, addr1 } = await loadFixture(deployFullSystemFixture);
      await expect(
        vantageRegistry.connect(addr1).registerVantageAgent("Bob", "analyst", "gpt-4", "ipfs://bob")
      ).to.be.revertedWithCustomError(vantageRegistry, "OwnableUnauthorizedAccount");
    });

    it("should revert on duplicate name", async function () {
      const { vantageRegistry } = await loadFixture(deployFullSystemFixture);
      const a = AGENTS[0];
      await vantageRegistry.registerVantageAgent(a.name, a.role, a.model, a.uri);
      await expect(
        vantageRegistry.registerVantageAgent(a.name, "other", "other", "ipfs://other")
      ).to.be.revertedWith("VantageAgentRegistry: agent already registered");
    });
  });

  // ─── getAgentByName() ──────────────────────────────────────────────────────

  describe("getAgentByName()", function () {
    async function setupAgents() {
      const fixtures = await loadFixture(deployFullSystemFixture);
      const { vantageRegistry } = fixtures;
      for (const a of AGENTS) {
        await vantageRegistry.registerVantageAgent(a.name, a.role, a.model, a.uri);
      }
      return fixtures;
    }

    it("should return correct agentId for each agent name", async function () {
      const { vantageRegistry } = await setupAgents();
      for (let i = 0; i < AGENTS.length; i++) {
        expect(await vantageRegistry.getAgentByName(AGENTS[i].name)).to.equal(BigInt(i + 1));
      }
    });

    it("should revert for unknown name", async function () {
      const { vantageRegistry } = await setupAgents();
      await expect(
        vantageRegistry.getAgentByName("Unknown")
      ).to.be.revertedWith("VantageAgentRegistry: agent not found");
    });
  });

  // ─── isVantageAgent() ──────────────────────────────────────────────────────

  describe("isVantageAgent()", function () {
    it("should return true for registered Vantage agents", async function () {
      const { vantageRegistry } = await loadFixture(deployFullSystemFixture);
      for (const a of AGENTS) {
        await vantageRegistry.registerVantageAgent(a.name, a.role, a.model, a.uri);
      }
      for (let i = 1; i <= AGENTS.length; i++) {
        expect(await vantageRegistry.isVantageAgent(BigInt(i))).to.be.true;
      }
    });

    it("should return false for non-Vantage agentId", async function () {
      const { vantageRegistry } = await loadFixture(deployFullSystemFixture);
      expect(await vantageRegistry.isVantageAgent(999n)).to.be.false;
    });

    it("should return false for agent registered directly in IdentityRegistry (not via VantageRegistry)", async function () {
      const { vantageRegistry, identityRegistry, addr1 } =
        await loadFixture(deployFullSystemFixture);
      await identityRegistry.connect(addr1).register("ipfs://direct");
      expect(await vantageRegistry.isVantageAgent(1n)).to.be.false;
    });
  });

  // ─── getAgentRole() ────────────────────────────────────────────────────────

  describe("getAgentRole()", function () {
    it("should return correct role for each Vantage agent", async function () {
      const { vantageRegistry } = await loadFixture(deployFullSystemFixture);
      for (const a of AGENTS) {
        await vantageRegistry.registerVantageAgent(a.name, a.role, a.model, a.uri);
      }
      for (let i = 0; i < AGENTS.length; i++) {
        expect(await vantageRegistry.getAgentRole(BigInt(i + 1))).to.equal(AGENTS[i].role);
      }
    });

    it("should revert for non-Vantage agentId", async function () {
      const { vantageRegistry } = await loadFixture(deployFullSystemFixture);
      await expect(vantageRegistry.getAgentRole(999n)).to.be.revertedWith(
        "VantageAgentRegistry: not a Vantage agent"
      );
    });
  });

  // ─── getAgentModel() ───────────────────────────────────────────────────────

  describe("getAgentModel()", function () {
    it("should return correct model for each Vantage agent", async function () {
      const { vantageRegistry } = await loadFixture(deployFullSystemFixture);
      for (const a of AGENTS) {
        await vantageRegistry.registerVantageAgent(a.name, a.role, a.model, a.uri);
      }
      for (let i = 0; i < AGENTS.length; i++) {
        expect(await vantageRegistry.getAgentModel(BigInt(i + 1))).to.equal(AGENTS[i].model);
      }
    });

    it("should revert for non-Vantage agentId", async function () {
      const { vantageRegistry } = await loadFixture(deployFullSystemFixture);
      await expect(vantageRegistry.getAgentModel(999n)).to.be.revertedWith(
        "VantageAgentRegistry: not a Vantage agent"
      );
    });
  });
});
