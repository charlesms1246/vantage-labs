import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying new template contracts to Flow EVM Testnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "FLOW");

  if (balance === 0n) {
    throw new Error("Deployer has no balance. Get testnet FLOW from https://faucet.flow.com/fund-account");
  }

  // Read the already-deployed VTG token address (from flow-testnet.json)
  const deployDir = path.join(__dirname, "../../deployments");
  const existingAddressesPath = path.join(deployDir, "flow-testnet.json");

  let vtgAddress: string;
  if (fs.existsSync(existingAddressesPath)) {
    const existing = JSON.parse(fs.readFileSync(existingAddressesPath, "utf-8"));
    vtgAddress = existing.contracts?.SampleToken;
    if (!vtgAddress) {
      throw new Error("SampleToken (VTG) address not found in deployments/flow-testnet.json");
    }
  } else {
    throw new Error(
      "deployments/flow-testnet.json not found. Run deploy-flow.ts first to deploy SampleToken."
    );
  }

  console.log("Using VTG (SampleToken) address:", vtgAddress, "\n");

  const now = Math.floor(Date.now() / 1000);
  const oneYearSecs = 365 * 24 * 60 * 60;
  const twoYearSecs = 2 * 365 * 24 * 60 * 60;

  const contracts: Record<string, { address: string }> = {};

  // 1. Deploy ERC1155MultiToken
  console.log("1. Deploying ERC1155MultiToken...");
  const ERC1155 = await ethers.getContractFactory("ERC1155MultiToken");
  const erc1155 = await ERC1155.deploy("Vantage Multi-Token", "VMT", "ipfs://{id}.json");
  await erc1155.waitForDeployment();
  const erc1155Address = await erc1155.getAddress();
  console.log("   ERC1155MultiToken deployed to:", erc1155Address);
  contracts["ERC1155MultiToken"] = { address: erc1155Address };

  // 2. Deploy NFTMarketplace
  console.log("\n2. Deploying NFTMarketplace...");
  const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
  const marketplace = await NFTMarketplace.deploy(250); // 2.5% fee (250 basis points)
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   NFTMarketplace deployed to:", marketplaceAddress);
  contracts["NFTMarketplace"] = { address: marketplaceAddress };

  // 3. Deploy SimpleDAO
  console.log("\n3. Deploying SimpleDAO...");
  const SimpleDAO = await ethers.getContractFactory("SimpleDAO");
  const dao = await SimpleDAO.deploy(
    vtgAddress,           // governance token
    259200,               // voting period: 3 days
    86400,                // timelock delay: 1 day
    ethers.parseEther("1000") // quorum: 1000 tokens
  );
  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();
  console.log("   SimpleDAO deployed to:", daoAddress);
  contracts["SimpleDAO"] = { address: daoAddress };

  // 4. Deploy StakingRewards
  console.log("\n4. Deploying StakingRewards...");
  const StakingRewards = await ethers.getContractFactory("StakingRewards");
  const staking = await StakingRewards.deploy(
    vtgAddress,          // staking token
    vtgAddress,          // reward token
    604800               // reward duration: 7 days
  );
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("   StakingRewards deployed to:", stakingAddress);
  contracts["StakingRewards"] = { address: stakingAddress };

  // 5. Deploy VestingWallet
  // Note: VestingWallet requires tokens to be transferred to it after deployment.
  // Skipping for now. To deploy manually:
  //   const VestingWallet = await ethers.getContractFactory("VestingWallet");
  //   const vesting = await VestingWallet.deploy(
  //     vtgAddress, deployer.address, now + oneYearSecs, now + twoYearSecs, ethers.parseEther("100000")
  //   );
  // Then transfer tokens: await token.transfer(vestingAddress, amount)
  console.log("\n5. Skipping VestingWallet (requires post-deployment token transfer)");

  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("Network: Flow EVM Testnet (Chain ID: 545)");
  console.log("ERC1155MultiToken:", erc1155Address);
  console.log("NFTMarketplace:   ", marketplaceAddress);
  console.log("SimpleDAO:        ", daoAddress);
  console.log("StakingRewards:   ", stakingAddress);
  console.log("VestingWallet:    [Skipped - requires post-deploy token transfer]");
  console.log("=========================================");

  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });

  const addresses = {
    network: "flow-evm-testnet",
    chainId: 545,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts,
  };
  fs.writeFileSync(
    path.join(deployDir, "flow-testnet-templates.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployments/flow-testnet-templates.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
