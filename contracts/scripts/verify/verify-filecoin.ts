import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const addresses = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../deployments/filecoin-calibnet.json"), "utf-8")
  );

  console.log("Verifying contracts on Filecoin Calibnet...\n");

  for (const [name, address] of Object.entries(addresses.contracts)) {
    console.log(`Verifying ${name} at ${address}...`);
    try {
      await run("verify:verify", {
        address,
        constructorArguments: name === "VantageAgentRegistry"
          ? [addresses.contracts.IdentityRegistry]
          : [],
      });
      console.log(`  ${name} verified ✓`);
    } catch (e: any) {
      console.log(`  ${name} verification failed: ${e.message}`);
    }
  }
}

main().catch(console.error);
