import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
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

export class GenerateContractTool extends StructuredTool {
  name = "generate_contract";
  description =
    "Generate compiled contract data ready for on-chain deployment. Returns ABI, bytecode, and constructorArgs — pass the entire output directly to deploy_contract.";
  schema = z.object({
    type: z.enum(["ERC20", "ERC721", "NFT"]).describe("Contract type: ERC20 for fungible token, ERC721/NFT for non-fungible token"),
    name: z.string().describe("Token or NFT collection name"),
    symbol: z.string().describe("Ticker symbol (e.g. VTG, VNFT)"),
    initialSupply: z.number().optional().describe("Initial supply for ERC20 tokens (default 1000000)"),
  });

  async _call({ type, name, symbol, initialSupply }: {
    type: string;
    name: string;
    symbol: string;
    initialSupply?: number;
  }): Promise<string> {
    const contractType = type.toUpperCase();
    const cleanSymbol = symbol.replace(/\s+/g, "");

    try {
      if (contractType === "ERC721" || contractType === "NFT") {
        const { abi, bytecode } = loadArtifact("SampleNFT");
        return JSON.stringify({
          type: "ERC721",
          name,
          symbol: cleanSymbol,
          abi,
          bytecode,
          constructorArgs: [name, cleanSymbol],
          note: `ERC721 NFT contract compiled. Pass this full JSON to deploy_contract as-is.`,
        });
      } else {
        const { abi, bytecode } = loadArtifact("SampleToken");
        const supply = initialSupply ?? 1_000_000;
        const supplyWei = (BigInt(supply) * BigInt(10 ** 18)).toString();
        return JSON.stringify({
          type: "ERC20",
          name,
          symbol: cleanSymbol,
          abi,
          bytecode,
          constructorArgs: [name, cleanSymbol, supplyWei],
          note: `ERC20 token compiled: ${name} (${cleanSymbol}) with ${supply} initial supply. Pass this full JSON to deploy_contract as-is.`,
        });
      }
    } catch (err) {
      return JSON.stringify({ error: `Failed to load contract artifact: ${(err as Error).message}` });
    }
  }
}

export class DeployContractTool extends StructuredTool {
  name = "deploy_contract";
  description =
    "Deploy a compiled smart contract to Flow EVM Testnet using the deployer wallet. Pass the full output from generate_contract directly. Returns the deployed contract address, txHash, and FlowScan links.";
  schema = z.object({
    bytecode: z.string().describe("Contract bytecode hex string"),
    abi: z.array(z.unknown()).describe("Contract ABI array"),
    constructorArgs: z.array(z.unknown()).optional().describe("Constructor arguments array"),
    label: z.string().optional().describe("Human-readable label for the contract"),
    name: z.string().optional().describe("Contract name"),
    symbol: z.string().optional().describe("Token symbol"),
  });

  async _call({ bytecode, abi, constructorArgs = [], label, name, symbol }: {
    bytecode: string;
    abi: ethers.InterfaceAbi;
    constructorArgs?: unknown[];
    label?: string;
    name?: string;
    symbol?: string;
  }): Promise<string> {
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

      const proof = JSON.stringify({
        contractLabel, name, symbol, address, txHash,
        network: "flow-evm-testnet", chainId: 545,
        deployedBy: await wallet.getAddress(),
        timestamp: new Date().toISOString(),
      });
      const proofCid = await lighthouseService.upload(proof);
      logger.info("IPFS", `[Rishi] Deployment proof stored`, { proofCid, proofUrl: lighthouseService.getGatewayUrl(proofCid), contractLabel });

      return JSON.stringify({
        success: true,
        contractLabel, address, txHash,
        network: "flow-evm-testnet", chainId: 545,
        explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
        contractUrl: `https://evm-testnet.flowscan.io/address/${address}`,
        proofCid, proofUrl: lighthouseService.getGatewayUrl(proofCid),
        message: `Successfully deployed ${contractLabel} to Flow EVM Testnet at ${address}`,
      });
    } catch (err) {
      logger.error("ONCHAIN", `[Rishi] Deployment failed: ${contractLabel}`, { error: (err as Error).message, contractLabel, network: "flow-evm-testnet" });
      return JSON.stringify({ error: (err as Error).message });
    }
  }
}

export class StoreProofTool extends StructuredTool {
  name = "store_proof";
  description = "Store any data or proof on Filecoin/IPFS via Lighthouse. Returns CID and gateway URL.";
  schema = z.object({
    data: z.string().describe("Data or proof to store (string or JSON)"),
  });

  async _call({ data }: { data: string }): Promise<string> {
    const cid = await lighthouseService.upload(data);
    return JSON.stringify({ cid, stored: true, url: lighthouseService.getGatewayUrl(cid) });
  }
}
