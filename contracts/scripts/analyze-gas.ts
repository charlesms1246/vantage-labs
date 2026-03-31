import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const filecoinAddresses = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/filecoin-calibnet.json"), "utf-8")
  );

  const identityRegistry = await ethers.getContractAt(
    "IdentityRegistry",
    filecoinAddresses.contracts.IdentityRegistry
  );

  console.log("=== Gas Analysis for Filecoin Calibnet ===\n");

  const registerGas = await identityRegistry.register.estimateGas("ipfs://QmTest");
  console.log(`Register Agent: ${registerGas.toString()} gas`);

  // Get an agent we own to estimate setMetadata
  const nextId = await identityRegistry.nextAgentId();
  // Use agentId that exists (agent 1 was registered by VantageAgentRegistry, not deployer, so skip)
  // Just report register gas
  console.log("\nGas analysis complete.");
}

main().catch(console.error);
