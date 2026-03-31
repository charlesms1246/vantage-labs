import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";

describe("Cross-Chain Verification Tests (Filecoin Calibnet)", function () {
  this.timeout(180000);

  let deployer: any;
  let filecoinAddresses: any;
  let vantageAgentRegistry: any;

  before(async function () {
    [deployer] = await ethers.getSigners();

    filecoinAddresses = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../deployments/filecoin-calibnet.json"),
        "utf-8"
      )
    );

    vantageAgentRegistry = await ethers.getContractAt(
      "VantageAgentRegistry",
      filecoinAddresses.contracts.VantageAgentRegistry
    );

    console.log(`Deployer: ${deployer.address}`);
    console.log(`VantageAgentRegistry (Filecoin): ${filecoinAddresses.contracts.VantageAgentRegistry}`);
  });

  it("should verify Harper is registered: getAgentByName('Harper') > 0 and isVantageAgent=true", async function () {
    const harperId = await vantageAgentRegistry.getAgentByName("Harper");
    console.log(`  Harper agentId: ${harperId}`);
    expect(harperId).to.be.gt(0n);

    const isVantage = await vantageAgentRegistry.isVantageAgent(harperId);
    expect(isVantage).to.equal(true);
    console.log(`  Harper isVantageAgent: ${isVantage}`);
  });

  it("should verify Rishi's model is 'claude-3.5-sonnet'", async function () {
    const rishiId = await vantageAgentRegistry.getAgentByName("Rishi");
    console.log(`  Rishi agentId: ${rishiId}`);
    expect(rishiId).to.be.gt(0n);

    const model = await vantageAgentRegistry.getAgentModel(rishiId);
    console.log(`  Rishi model: ${model}`);
    expect(model).to.equal("claude-3.5-sonnet");
  });

  it("should log cross-chain verification message", async function () {
    const harperId = await vantageAgentRegistry.getAgentByName("Harper");
    const isVantage = await vantageAgentRegistry.isVantageAgent(harperId);

    expect(isVantage).to.equal(true);

    console.log(
      "Cross-chain verification: Harper verified on Filecoin. Ready to execute on Flow."
    );
  });
});
