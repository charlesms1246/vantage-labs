import { ethers, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const addresses = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../deployments/flow-testnet.json"), "utf-8")
  );

  console.log("Verifying contracts on Flow EVM Testnet...\n");

  const contractArgs: Record<string, unknown[]> = {
    SampleToken: ["Vantage Token", "VTG", ethers.parseEther("1000000")],
    SampleNFT: ["Vantage NFT", "VNFT"],
    TippingContract: [],
  };

  for (const [name, address] of Object.entries(addresses.contracts)) {
    console.log(`Verifying ${name} at ${address}...`);
    try {
      await run("verify:verify", {
        address,
        constructorArguments: contractArgs[name] ?? [],
      });
      console.log(`  ${name} verified ✓`);
    } catch (e: any) {
      console.log(`  ${name} verification failed: ${e.message}`);
    }
  }
}

main().catch(console.error);
