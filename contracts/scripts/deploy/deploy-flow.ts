import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying to Flow EVM Testnet...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "FLOW");

  if (balance === 0n) {
    throw new Error("Deployer has no balance. Get testnet FLOW from https://faucet.flow.com/fund-account");
  }

  console.log("\n1. Deploying SampleToken...");
  const SampleToken = await ethers.getContractFactory("SampleToken");
  const sampleToken = await SampleToken.deploy(
    "Vantage Token",
    "VTG",
    ethers.parseEther("1000000")
  );
  await sampleToken.waitForDeployment();
  const tokenAddress = await sampleToken.getAddress();
  console.log("SampleToken deployed to:", tokenAddress);

  console.log("\n2. Deploying SampleNFT...");
  const SampleNFT = await ethers.getContractFactory("SampleNFT");
  const sampleNFT = await SampleNFT.deploy("Vantage NFT", "VNFT");
  await sampleNFT.waitForDeployment();
  const nftAddress = await sampleNFT.getAddress();
  console.log("SampleNFT deployed to:", nftAddress);

  console.log("\n3. Deploying TippingContract...");
  const TippingContract = await ethers.getContractFactory("TippingContract");
  const tippingContract = await TippingContract.deploy();
  await tippingContract.waitForDeployment();
  const tippingAddress = await tippingContract.getAddress();
  console.log("TippingContract deployed to:", tippingAddress);

  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("Network: Flow EVM Testnet (Chain ID: 545)");
  console.log("SampleToken:     ", tokenAddress);
  console.log("SampleNFT:       ", nftAddress);
  console.log("TippingContract: ", tippingAddress);
  console.log("=========================================");

  const deployDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });

  const addresses = {
    network: "flow-evm-testnet",
    chainId: 545,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SampleToken: tokenAddress,
      SampleNFT: nftAddress,
      TippingContract: tippingAddress,
    },
  };
  fs.writeFileSync(
    path.join(deployDir, "flow-testnet.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployments/flow-testnet.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
