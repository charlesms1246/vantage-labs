import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployFile = path.join(__dirname, "../deployments/filecoin-calibnet.json");
  if (!fs.existsSync(deployFile)) {
    throw new Error("deployments/filecoin-calibnet.json not found. Run deploy-filecoin first.");
  }
  const filecoinAddresses = JSON.parse(fs.readFileSync(deployFile, "utf-8"));

  const vantageRegistry = await ethers.getContractAt(
    "VantageAgentRegistry",
    filecoinAddresses.contracts.VantageAgentRegistry
  );

  const agents = [
    { name: "Eric",   role: "market_analyst",       model: "gemini",           agentURI: "ipfs://QmEricVantageAgent" },
    { name: "Harper", role: "trader",                model: "groq-llama",       agentURI: "ipfs://QmHarperVantageAgent" },
    { name: "Rishi",  role: "developer",             model: "claude-3.5-sonnet",agentURI: "ipfs://QmRishiVantageAgent" },
    { name: "Yasmin", role: "creative",              model: "gemini",           agentURI: "ipfs://QmYasminVantageAgent" },
  ];

  console.log("Registering Vantage agents on Filecoin Calibnet...\n");

  const registeredAgents: Record<string, number> = {};

  for (const agent of agents) {
    console.log(`Registering ${agent.name} (${agent.role})...`);
    const tx = await vantageRegistry.registerVantageAgent(
      agent.name,
      agent.role,
      agent.model,
      agent.agentURI
    );
    const receipt = await tx.wait();
    const agentId = await vantageRegistry.getAgentByName(agent.name);
    console.log(`  ${agent.name} registered: agentId=${agentId}, tx=${receipt?.hash}`);
    registeredAgents[agent.name] = Number(agentId);
  }

  console.log("\n===== AGENT REGISTRATION SUMMARY =====");
  for (const [name, id] of Object.entries(registeredAgents)) {
    console.log(`  ${name}: agentId ${id}`);
  }

  // Update deployments file with agent IDs
  filecoinAddresses.agents = registeredAgents;
  fs.writeFileSync(deployFile, JSON.stringify(filecoinAddresses, null, 2));
  console.log("\nAgent IDs saved to deployments/filecoin-calibnet.json");
}

main().catch(console.error);
