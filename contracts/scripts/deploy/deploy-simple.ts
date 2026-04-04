import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Deploying template contracts to Flow EVM Testnet (direct ethers)...\n");

  const FLOW_RPC = "https://testnet.evm.nodes.onflow.org";
  const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY or DEPLOYER_PRIVATE_KEY env var not set");
  }

  const provider = new ethers.JsonRpcProvider(FLOW_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deployer address:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "FLOW\n");

  if (balance === 0n) {
    throw new Error("Deployer has no balance. Get testnet FLOW from https://faucet.flow.com/fund-account");
  }

  // Load VTG address from existing deployments
  const deployDir = path.join(__dirname, "../../deployments");
  const existingPath = path.join(deployDir, "flow-testnet.json");
  let vtgAddress: string;

  if (fs.existsSync(existingPath)) {
    const existing = JSON.parse(fs.readFileSync(existingPath, "utf-8"));
    vtgAddress = existing.contracts?.SampleToken;
    if (!vtgAddress) throw new Error("SampleToken (VTG) not found in flow-testnet.json");
  } else {
    throw new Error("flow-testnet.json not found — run deploy-flow.ts first");
  }

  console.log("Using VTG address:", vtgAddress, "\n");

  const now = Math.floor(Date.now() / 1000);
  const oneYearSecs = 365 * 24 * 60 * 60;
  const contracts: Record<string, { address: string }> = {};

  // Load artifacts manually
  const artifactsDir = path.join(__dirname, "../../artifacts/contracts/templates");

  function loadArtifact(name: string) {
    const artifactPath = path.join(artifactsDir, `${name}.sol/${name}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    return artifact;
  }

  // 1. ERC1155MultiToken
  console.log("1. Deploying ERC1155MultiToken...");
  const erc1155Artifact = loadArtifact("ERC1155MultiToken");
  const erc1155Factory = new ethers.ContractFactory(erc1155Artifact.abi, erc1155Artifact.bytecode, wallet);
  const erc1155 = await erc1155Factory.deploy("Vantage Multi-Token", "VMT", "ipfs://{id}.json");
  const erc1155Tx = await erc1155.waitForDeployment();
  const erc1155Address = await erc1155.getAddress();
  console.log("   ✓ Deployed to:", erc1155Address);
  contracts["ERC1155MultiToken"] = { address: erc1155Address };

  // 2. NFTMarketplace
  console.log("\n2. Deploying NFTMarketplace...");
  const marketplaceArtifact = loadArtifact("NFTMarketplace");
  const marketplaceFactory = new ethers.ContractFactory(marketplaceArtifact.abi, marketplaceArtifact.bytecode, wallet);
  const marketplace = await marketplaceFactory.deploy(250);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   ✓ Deployed to:", marketplaceAddress);
  contracts["NFTMarketplace"] = { address: marketplaceAddress };

  // 3. SimpleDAO
  console.log("\n3. Deploying SimpleDAO...");
  const daoArtifact = loadArtifact("SimpleDAO");
  const daoFactory = new ethers.ContractFactory(daoArtifact.abi, daoArtifact.bytecode, wallet);
  const dao = await daoFactory.deploy(
    vtgAddress,
    259200, // 3 days
    86400,  // 1 day
    ethers.parseEther("1000") // 1000 tokens quorum
  );
  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();
  console.log("   ✓ Deployed to:", daoAddress);
  contracts["SimpleDAO"] = { address: daoAddress };

  // 4. StakingRewards
  console.log("\n4. Deploying StakingRewards...");
  const stakingArtifact = loadArtifact("StakingRewards");
  const stakingFactory = new ethers.ContractFactory(stakingArtifact.abi, stakingArtifact.bytecode, wallet);
  const staking = await stakingFactory.deploy(
    vtgAddress, // staking token
    vtgAddress, // reward token
    604800      // 7 days
  );
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("   ✓ Deployed to:", stakingAddress);
  contracts["StakingRewards"] = { address: stakingAddress };

  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("Network: Flow EVM Testnet (Chain ID: 545)");
  console.log("ERC1155MultiToken:", erc1155Address);
  console.log("NFTMarketplace:   ", marketplaceAddress);
  console.log("SimpleDAO:        ", daoAddress);
  console.log("StakingRewards:   ", stakingAddress);
  console.log("=========================================\n");

  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });

  const addresses = {
    network: "flow-evm-testnet",
    chainId: 545,
    deployedAt: new Date().toISOString(),
    deployer: wallet.address,
    contracts,
  };

  fs.writeFileSync(
    path.join(deployDir, "flow-testnet-templates.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("✓ Addresses saved to deployments/flow-testnet-templates.json");
}

main().catch((err) => {
  console.error("✗ Error:", err.message);
  process.exit(1);
});
