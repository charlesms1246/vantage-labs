import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";

describe("On-Chain Identity Integration Tests (Filecoin Calibnet)", function () {
  this.timeout(180000);

  let deployer: any;
  let addresses: any;
  let identityRegistry: any;
  let reputationRegistry: any;
  let vantageAgentRegistry: any;

  before(async function () {
    [deployer] = await ethers.getSigners();

    addresses = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../deployments/filecoin-calibnet.json"),
        "utf-8"
      )
    );

    identityRegistry = await ethers.getContractAt(
      "IdentityRegistry",
      addresses.contracts.IdentityRegistry
    );

    reputationRegistry = await ethers.getContractAt(
      "ReputationRegistry",
      addresses.contracts.ReputationRegistry
    );

    vantageAgentRegistry = await ethers.getContractAt(
      "VantageAgentRegistry",
      addresses.contracts.VantageAgentRegistry
    );

    console.log(`Deployer: ${deployer.address}`);
    console.log(`IdentityRegistry: ${addresses.contracts.IdentityRegistry}`);
    console.log(`ReputationRegistry: ${addresses.contracts.ReputationRegistry}`);
    console.log(`VantageAgentRegistry: ${addresses.contracts.VantageAgentRegistry}`);
  });

  it("should register a new test agent, emit Registered event, and confirm agentId > 0", async function () {
    const testURI = "ipfs://QmTestAgent" + Date.now();
    const tx = await identityRegistry.register(testURI);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    // Find Registered event
    const registeredEvent = receipt.logs
      .map((log: any) => {
        try {
          return identityRegistry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e && e.name === "Registered");

    expect(registeredEvent, "Registered event not found").to.not.be.null;
    const agentId = registeredEvent.args.agentId;
    expect(agentId).to.be.gt(0n);
    console.log(`  Registered new agent with ID: ${agentId.toString()}`);

    // Store for later tests
    (this as any).newAgentId = agentId;
    (global as any).__testAgentId = agentId;
    (global as any).__testAgentURI = testURI;
  });

  it("should retrieve tokenURI of a registered agent containing 'ipfs://'", async function () {
    // Use Eric (agentId=1) which we know is registered
    const ericId = BigInt(addresses.agents.Eric);
    const uri = await identityRegistry.tokenURI(ericId);
    console.log(`  Eric tokenURI: ${uri}`);
    expect(uri).to.include("ipfs://");
  });

  it("should update agent URI via setAgentURI and verify tokenURI changes", async function () {
    // Register fresh agent (deployer owns it)
    const originalURI = "ipfs://QmOriginal" + Date.now();
    const tx1 = await identityRegistry.register(originalURI);
    const receipt1 = await tx1.wait();

    const registeredEvent = receipt1.logs
      .map((log: any) => {
        try {
          return identityRegistry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e && e.name === "Registered");

    const agentId = registeredEvent.args.agentId;
    const uriAfterRegister = await identityRegistry.tokenURI(agentId);
    expect(uriAfterRegister).to.equal(originalURI);

    // Update URI
    const newURI = "ipfs://QmUpdated" + Date.now();
    const tx2 = await identityRegistry.setAgentURI(agentId, newURI);
    await tx2.wait();

    const uriAfterUpdate = await identityRegistry.tokenURI(agentId);
    expect(uriAfterUpdate).to.equal(newURI);
    console.log(`  Updated agentId ${agentId} URI from ${originalURI} to ${newURI}`);
  });

  it("should set and get metadata using ethers.toUtf8Bytes / ethers.toUtf8String", async function () {
    // Register fresh agent (deployer owns it)
    const agentURI = "ipfs://QmMetaTest" + Date.now();
    const tx1 = await identityRegistry.register(agentURI);
    const receipt1 = await tx1.wait();

    const registeredEvent = receipt1.logs
      .map((log: any) => {
        try {
          return identityRegistry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e && e.name === "Registered");

    const agentId = registeredEvent.args.agentId;

    const metaKey = "description";
    const metaValue = "Integration test agent - Phase 4";
    const metaBytes = ethers.toUtf8Bytes(metaValue);

    const tx2 = await identityRegistry.setMetadata(agentId, metaKey, metaBytes);
    await tx2.wait();

    const storedBytes = await identityRegistry.getMetadata(agentId, metaKey);
    const storedString = ethers.toUtf8String(storedBytes);
    expect(storedString).to.equal(metaValue);
    console.log(`  Metadata set/get OK: key="${metaKey}", value="${storedString}"`);
  });

  it("should give feedback to Eric (agentId=1, owned by VantageAgentRegistry contract) and verify feedback stored", async function () {
    // Eric (agentId=1) is owned by the VantageAgentRegistry contract, not the deployer directly
    // So deployer CAN give feedback to Eric
    const ericId = BigInt(addresses.agents.Eric);

    // Check Eric's owner
    const ericOwner = await identityRegistry["ownerOf(uint256)"](ericId);
    console.log(`  Eric owner: ${ericOwner}`);
    console.log(`  VantageAgentRegistry: ${addresses.contracts.VantageAgentRegistry}`);

    // Get feedback count before
    const countBefore = await reputationRegistry.getFeedbackCount(ericId, deployer.address);
    console.log(`  Feedback count before: ${countBefore}`);

    if (ericOwner.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("  SKIP: Deployer owns Eric's token directly — self-feedback would revert.");
      console.log("  Testing self-feedback revert instead...");
      // Test that self-feedback correctly reverts
      await expect(
        reputationRegistry.giveFeedback(
          ericId,
          100,
          2,
          "accuracy",
          "speed",
          "https://api.vantage.ai/eric",
          "ipfs://QmFeedback",
          ethers.ZeroHash
        )
      ).to.be.revertedWith("ReputationRegistry: cannot self-feedback");
      console.log("  Self-feedback revert confirmed correctly.");
      return;
    }

    const feedbackValue = 90;
    const feedbackDecimals = 2;
    const tag1 = "accuracy";
    const tag2 = "speed";
    const endpoint = "https://api.vantage.ai/eric";
    const feedbackURI = "ipfs://QmFeedbackTest" + Date.now();
    const feedbackHash = ethers.ZeroHash;

    const tx = await reputationRegistry.giveFeedback(
      ericId,
      feedbackValue,
      feedbackDecimals,
      tag1,
      tag2,
      endpoint,
      feedbackURI,
      feedbackHash
    );
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    const countAfter = await reputationRegistry.getFeedbackCount(ericId, deployer.address);
    expect(countAfter).to.equal(countBefore + 1n);

    // Retrieve the feedback at index countBefore (0-indexed)
    const feedback = await reputationRegistry.getFeedback(ericId, deployer.address, countBefore);
    expect(feedback.value).to.equal(feedbackValue);
    expect(feedback.tag1).to.equal(tag1);
    expect(feedback.tag2).to.equal(tag2);
    expect(feedback.client).to.equal(deployer.address);
    console.log(`  Feedback given to Eric at index ${countBefore}, value=${feedback.value}`);
  });

  it("should retrieve all 4 agents by name and verify isVantageAgent=true", async function () {
    const agentNames = ["Eric", "Harper", "Rishi", "Yasmin"];

    for (const name of agentNames) {
      const agentId = await vantageAgentRegistry.getAgentByName(name);
      expect(agentId).to.be.gt(0n);

      const isVantage = await vantageAgentRegistry.isVantageAgent(agentId);
      expect(isVantage).to.equal(true);
      console.log(`  ${name}: agentId=${agentId}, isVantageAgent=true`);
    }
  });

  it("should verify Eric's role is 'market_analyst'", async function () {
    const ericId = BigInt(addresses.agents.Eric);
    const role = await vantageAgentRegistry.getAgentRole(ericId);
    console.log(`  Eric role: ${role}`);
    expect(role).to.equal("market_analyst");
  });
});
