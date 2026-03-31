import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying to Filecoin Calibnet...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "FIL");

  if (balance === 0n) {
    throw new Error("Deployer has no balance. Get testnet FIL from https://faucet.calibnet.chainsafe-fil.io");
  }

  // Deploy IdentityRegistry
  console.log("\n1. Deploying IdentityRegistry...");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log("IdentityRegistry deployed to:", identityAddress);

  // Deploy ReputationRegistry
  console.log("\n2. Deploying ReputationRegistry...");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy();
  await reputationRegistry.waitForDeployment();
  const reputationAddress = await reputationRegistry.getAddress();
  console.log("ReputationRegistry deployed to:", reputationAddress);

  // Initialize ReputationRegistry
  console.log("\n3. Initializing ReputationRegistry...");
  const initTx = await reputationRegistry.initialize(identityAddress);
  await initTx.wait();
  console.log("ReputationRegistry initialized");

  // Deploy VantageAgentRegistry
  console.log("\n4. Deploying VantageAgentRegistry...");
  const VantageAgentRegistry = await ethers.getContractFactory("VantageAgentRegistry");
  const vantageRegistry = await VantageAgentRegistry.deploy(identityAddress);
  await vantageRegistry.waitForDeployment();
  const vantageAddress = await vantageRegistry.getAddress();
  console.log("VantageAgentRegistry deployed to:", vantageAddress);

  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("Network: Filecoin Calibnet (Chain ID: 314159)");
  console.log("IdentityRegistry:     ", identityAddress);
  console.log("ReputationRegistry:   ", reputationAddress);
  console.log("VantageAgentRegistry: ", vantageAddress);
  console.log("=========================================");

  const deployDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });

  const addresses = {
    network: "filecoin-calibnet",
    chainId: 314159,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      IdentityRegistry: identityAddress,
      ReputationRegistry: reputationAddress,
      VantageAgentRegistry: vantageAddress,
    },
  };
  fs.writeFileSync(
    path.join(deployDir, "filecoin-calibnet.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployments/filecoin-calibnet.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
