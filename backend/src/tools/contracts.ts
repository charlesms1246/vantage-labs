import { Tool } from "@langchain/core/tools";
import { ethers } from "ethers";
import path from "path";
import { lighthouseService } from "../services/lighthouse";
import { flowProvider, getDeployerWallet } from "../config/chains";
import { logger } from "../services/logger";

// Load pre-compiled Hardhat artifacts — real bytecode for on-chain deployment
const ARTIFACTS_DIR = path.resolve(__dirname, "../../../contracts/artifacts/contracts/templates");

function loadArtifact(contractName: string): { abi: ethers.InterfaceAbi; bytecode: string } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const artifact = require(`${ARTIFACTS_DIR}/${contractName}.sol/${contractName}.json`);
  return { abi: artifact.abi, bytecode: artifact.bytecode };
}

export class GenerateContractTool extends Tool {
  name = "generate_contract";
  description =
    "Generate compiled contract data ready for on-chain deployment. Input: JSON with 'type' (\"ERC20\" or \"ERC721\"), 'name' (token name), 'symbol' (ticker), and for ERC20 optionally 'initialSupply' (default 1000000). Returns ABI, bytecode, and constructorArgs — pass the entire output directly to deploy_contract.";

  async _call(input: string): Promise<string> {
    let params: { type?: string; name?: string; symbol?: string; initialSupply?: number } = {};
    try {
      params = JSON.parse(input);
    } catch {
      // Try to extract name from plain text
      params = { name: input.trim() || "CustomToken", symbol: "CTK", type: "ERC20" };
    }

    const contractType = (params.type || "ERC20").toUpperCase();
    const tokenName = params.name || "CustomToken";
    const symbol = (params.symbol || tokenName.slice(0, 4).toUpperCase()).replace(/\s+/g, "");

    try {
      if (contractType === "ERC721" || contractType === "NFT") {
        const { abi, bytecode } = loadArtifact("SampleNFT");
        return JSON.stringify({
          type: "ERC721",
          name: tokenName,
          symbol,
          abi,
          bytecode,
          constructorArgs: [tokenName, symbol],
          note: `ERC721 NFT contract compiled. Pass this full JSON to deploy_contract as-is.`,
        });
      } else {
        // ERC20 — SampleToken takes (name, symbol, initialSupply)
        const { abi, bytecode } = loadArtifact("SampleToken");
        const initialSupply = params.initialSupply ?? 1_000_000;
        const supplyWei = (BigInt(initialSupply) * BigInt(10 ** 18)).toString();
        return JSON.stringify({
          type: "ERC20",
          name: tokenName,
          symbol,
          abi,
          bytecode,
          constructorArgs: [tokenName, symbol, supplyWei],
          note: `ERC20 token compiled: ${tokenName} (${symbol}) with ${initialSupply} initial supply. Pass this full JSON to deploy_contract as-is.`,
        });
      }
    } catch (err) {
      return JSON.stringify({ error: `Failed to load contract artifact: ${(err as Error).message}` });
    }
  }
}

export class DeployContractTool extends Tool {
  name = "deploy_contract";
  description =
    "Deploy a compiled smart contract to Flow EVM Testnet using the deployer wallet. Input: JSON with 'bytecode' (hex string), 'abi' (array), 'constructorArgs' (array, optional), and 'label' (string, optional). You can pass the full output from generate_contract directly. Returns the deployed contract address, txHash, and FlowScan links.";

  async _call(input: string): Promise<string> {
    let parsed: {
      bytecode: string;
      abi: ethers.InterfaceAbi;
      constructorArgs?: unknown[];
      label?: string;
      name?: string;
      symbol?: string;
    };

    try {
      parsed = JSON.parse(input);
    } catch {
      return JSON.stringify({ error: "Invalid JSON input — provide bytecode, abi, and optional constructorArgs" });
    }

    const { bytecode, abi, constructorArgs = [], label, name, symbol } = parsed;

    if (!bytecode || !abi) {
      return JSON.stringify({ error: "Missing required fields: bytecode and abi. Run generate_contract first." });
    }

    const contractLabel = label || name || "UnnamedContract";

    try {
      const wallet = getDeployerWallet(flowProvider);
      const factory = new ethers.ContractFactory(abi, bytecode, wallet);

      logger.info("ONCHAIN", `[Rishi] Deploying ${contractLabel} to Flow EVM Testnet`, { contractLabel, name, symbol, network: "flow-evm-testnet" });
      const contract = await factory.deploy(...constructorArgs);
      await contract.waitForDeployment();

      const address = await contract.getAddress();
      const deployTx = contract.deploymentTransaction();
      const txHash = deployTx?.hash ?? "unknown";

      logger.info("ONCHAIN", `[Rishi] Contract deployed: ${contractLabel}`, {
        address,
        txHash,
        explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
        contractUrl: `https://evm-testnet.flowscan.io/address/${address}`,
        network: "flow-evm-testnet",
      });

      // Store deployment proof on Lighthouse
      const proof = JSON.stringify({
        contractLabel,
        name,
        symbol,
        address,
        txHash,
        network: "flow-evm-testnet",
        chainId: 545,
        deployedBy: await wallet.getAddress(),
        timestamp: new Date().toISOString(),
      });
      const proofCid = await lighthouseService.upload(proof);
      logger.info("IPFS", `[Rishi] Deployment proof stored`, { proofCid, proofUrl: lighthouseService.getGatewayUrl(proofCid), contractLabel });

      return JSON.stringify({
        success: true,
        contractLabel,
        address,
        txHash,
        network: "flow-evm-testnet",
        chainId: 545,
        explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
        contractUrl: `https://evm-testnet.flowscan.io/address/${address}`,
        proofCid,
        proofUrl: lighthouseService.getGatewayUrl(proofCid),
        message: `Successfully deployed ${contractLabel} to Flow EVM Testnet at ${address}`,
      });
    } catch (err) {
      logger.error("ONCHAIN", `[Rishi] Deployment failed: ${contractLabel}`, { error: (err as Error).message, contractLabel, network: "flow-evm-testnet" });
      return JSON.stringify({ error: (err as Error).message });
    }
  }
}

export class StoreProofTool extends Tool {
  name = "store_proof";
  description =
    "Store any data or proof on Filecoin/IPFS via Lighthouse. Input: JSON with 'bytecode' and 'metadata' fields, or any string. Returns CID and gateway URL.";

  async _call(input: string): Promise<string> {
    const cid = await lighthouseService.upload(input);
    return JSON.stringify({ cid, stored: true, url: lighthouseService.getGatewayUrl(cid) });
  }
}
