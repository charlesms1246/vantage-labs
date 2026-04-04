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
    "Generate compiled contract data ready for on-chain deployment. Supports ERC20, ERC721/NFT, ERC1155, NFT Marketplace, DAO, Staking, Vesting, and Tipping contracts. Returns ABI, bytecode, and constructorArgs — pass the entire output directly to deploy_contract.";
  schema = z.object({
    type: z
      .enum(["ERC20", "ERC721", "NFT", "ERC1155", "MARKETPLACE", "DAO", "STAKING", "VESTING", "TIPPING"])
      .describe(
        "Contract type: ERC20 (fungible), ERC721/NFT (non-fungible), ERC1155 (multi-token), MARKETPLACE (NFT trading), DAO (governance), STAKING (rewards), VESTING (linear unlock), TIPPING (ETH/FLOW tips)"
      ),
    name: z.string().optional().describe("Token/collection/contract name (required for most types)"),
    symbol: z.string().optional().describe("Ticker symbol (required for ERC20, ERC721, ERC1155)"),
    initialSupply: z.number().optional().describe("Initial supply for ERC20 tokens (default 1000000)"),
    baseURI: z.string().optional().describe("Base metadata URI for ERC1155 (e.g. ipfs://{id}.json)"),
    feeBps: z.number().optional().describe("Platform fee in basis points for Marketplace (e.g. 250 = 2.5%)"),
    governanceToken: z.string().optional().describe("ERC20 token address for DAO governance"),
    votingPeriod: z.number().optional().describe("DAO voting period in seconds (default 259200 = 3 days)"),
    timelockDelay: z.number().optional().describe("DAO timelock delay in seconds (default 86400 = 1 day)"),
    quorumVotes: z.string().optional().describe("DAO quorum in raw token units (e.g. 1000000000000000000 for 1 token)"),
    stakingToken: z.string().optional().describe("ERC20 token address users stake"),
    rewardToken: z.string().optional().describe("ERC20 token distributed as rewards"),
    rewardsDuration: z.number().optional().describe("Staking reward period in seconds (default 604800 = 7 days)"),
    vestingToken: z.string().optional().describe("ERC20 token address to vest"),
    beneficiary: z.string().optional().describe("Beneficiary wallet address for vesting"),
    cliffEnd: z.number().optional().describe("Unix timestamp when cliff ends (vesting begins)"),
    vestingEnd: z.number().optional().describe("Unix timestamp when vesting fully completes"),
    totalAmount: z.string().optional().describe("Total tokens to vest (in raw wei)"),
  });

  async _call(params: Record<string, unknown>): Promise<string> {
    const type = (params.type as string).toUpperCase();
    const name = (params.name as string | undefined) ?? "";
    const symbol = (params.symbol as string | undefined) ?? "";

    try {
      if (type === "ERC721" || type === "NFT") {
        const { abi, bytecode } = loadArtifact("SampleNFT");
        const cleanSymbol = symbol.replace(/\s+/g, "");
        return JSON.stringify({
          type: "ERC721",
          name,
          symbol: cleanSymbol,
          abi,
          bytecode,
          constructorArgs: [name, cleanSymbol],
          note: "ERC721 NFT contract compiled. Pass full JSON to deploy_contract.",
        });
      }

      if (type === "ERC20") {
        const { abi, bytecode } = loadArtifact("SampleToken");
        const supply = (params.initialSupply as number | undefined) ?? 1_000_000;
        const supplyWei = (BigInt(supply) * BigInt(10 ** 18)).toString();
        const cleanSymbol = symbol.replace(/\s+/g, "");
        return JSON.stringify({
          type: "ERC20",
          name,
          symbol: cleanSymbol,
          abi,
          bytecode,
          constructorArgs: [name, cleanSymbol, supplyWei],
          note: `ERC20 token: ${name} (${cleanSymbol}) with ${supply} initial supply.`,
        });
      }

      if (type === "ERC1155") {
        const { abi, bytecode } = loadArtifact("ERC1155MultiToken");
        const cleanSymbol = symbol.replace(/\s+/g, "");
        const baseURI = (params.baseURI as string | undefined) ?? "ipfs://{id}.json";
        return JSON.stringify({
          type: "ERC1155",
          name,
          symbol: cleanSymbol,
          abi,
          bytecode,
          constructorArgs: [name, cleanSymbol, baseURI],
          note: `ERC1155 multi-token contract: ${name} (${cleanSymbol}) with baseURI ${baseURI}.`,
        });
      }

      if (type === "MARKETPLACE") {
        const { abi, bytecode } = loadArtifact("NFTMarketplace");
        const feeBps = (params.feeBps as number | undefined) ?? 250;
        if (feeBps < 0 || feeBps > 1000) {
          throw new Error("feeBps must be between 0 and 1000 (0% to 10%)");
        }
        return JSON.stringify({
          type: "MARKETPLACE",
          abi,
          bytecode,
          constructorArgs: [feeBps],
          note: `NFT Marketplace with platform fee ${feeBps} basis points (${(feeBps / 100).toFixed(1)}%).`,
        });
      }

      if (type === "DAO") {
        const { abi, bytecode } = loadArtifact("SimpleDAO");
        const governanceToken = params.governanceToken as string;
        if (!governanceToken) throw new Error("governanceToken address required for DAO");
        const votingPeriod = (params.votingPeriod as number | undefined) ?? 259200;
        const timelockDelay = (params.timelockDelay as number | undefined) ?? 86400;
        const quorumVotesStr = (params.quorumVotes as string | undefined) ?? ethers.parseEther("1000").toString();
        return JSON.stringify({
          type: "DAO",
          abi,
          bytecode,
          constructorArgs: [governanceToken, votingPeriod, timelockDelay, quorumVotesStr],
          note: `DAO with voting period ${votingPeriod}s, timelock ${timelockDelay}s, quorum ${quorumVotesStr} tokens.`,
        });
      }

      if (type === "STAKING") {
        const { abi, bytecode } = loadArtifact("StakingRewards");
        const stakingToken = params.stakingToken as string;
        const rewardToken = params.rewardToken as string;
        if (!stakingToken || !rewardToken) {
          throw new Error("stakingToken and rewardToken addresses required for StakingRewards");
        }
        const rewardsDuration = (params.rewardsDuration as number | undefined) ?? 604800;
        return JSON.stringify({
          type: "STAKING",
          abi,
          bytecode,
          constructorArgs: [stakingToken, rewardToken, rewardsDuration],
          note: `Staking contract: stake ${stakingToken}, earn ${rewardToken} over ${rewardsDuration}s periods.`,
        });
      }

      if (type === "VESTING") {
        const { abi, bytecode } = loadArtifact("VestingWallet");
        const vestingToken = params.vestingToken as string;
        const beneficiary = params.beneficiary as string;
        const cliffEnd = params.cliffEnd as number | undefined;
        const vestingEnd = params.vestingEnd as number | undefined;
        const totalAmount = params.totalAmount as string | undefined;
        if (!vestingToken || !beneficiary || cliffEnd === undefined || vestingEnd === undefined) {
          throw new Error("vestingToken, beneficiary, cliffEnd, and vestingEnd required for VestingWallet");
        }
        const amount = totalAmount ?? "0";
        return JSON.stringify({
          type: "VESTING",
          abi,
          bytecode,
          constructorArgs: [vestingToken, beneficiary, cliffEnd, vestingEnd, amount],
          note: `Vesting: cliff ${new Date(cliffEnd * 1000).toISOString()}, vesting ${new Date(vestingEnd * 1000).toISOString()}.`,
        });
      }

      if (type === "TIPPING") {
        const { abi, bytecode } = loadArtifact("TippingContract");
        return JSON.stringify({
          type: "TIPPING",
          abi,
          bytecode,
          constructorArgs: [],
          note: "Tipping contract for ETH/FLOW accumulation and withdrawal (no constructor args).",
        });
      }

      throw new Error(`Unknown contract type: ${type}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err ?? 'Unknown error');
      return JSON.stringify({ error: `Failed to load contract artifact: ${errMsg}` });
    }
  }
}

export class DeployContractTool extends StructuredTool {
  name = "deploy_contract";
  description =
    "Deploy a compiled smart contract to Flow EVM Testnet using the deployer wallet. Pass the full output from generate_contract directly. Returns the deployed contract address, txHash, and FlowScan links.";
  // .passthrough() lets extra fields from generate_contract output (type, note) flow through
  // without Zod rejecting the payload. abi accepts both an array or a JSON string.
  schema = z.object({
    bytecode: z.string().describe("Contract bytecode hex string"),
    abi: z
      .union([
        z.array(z.unknown()),
        z.string().transform((s) => JSON.parse(s)),
      ])
      .describe("Contract ABI — array or JSON-stringified array from generate_contract"),
    constructorArgs: z.array(z.unknown()).optional().describe("Constructor arguments array"),
    label: z.string().optional().describe("Human-readable label for the contract"),
    name: z.string().optional().describe("Contract name"),
    symbol: z.string().optional().describe("Token symbol"),
    // accept extra fields emitted by generate_contract (type, note) without throwing
    type: z.string().optional(),
    note: z.string().optional(),
  });

  async _call({ bytecode, abi, constructorArgs = [], label, name, symbol }: {
    bytecode: string;
    abi: ethers.InterfaceAbi;
    constructorArgs?: unknown[];
    label?: string;
    name?: string;
    symbol?: string;
    type?: string;
    note?: string;
  }): Promise<string> {
    if (!bytecode || !abi) {
      return JSON.stringify({ error: "Missing required fields: bytecode and abi. Run generate_contract first." });
    }

    // Early-exit with a clear message rather than a cryptic ethers error
    const { config } = await import("../config/env");
    if (!config.DEPLOYER_PRIVATE_KEY) {
      return JSON.stringify({ error: "DEPLOYER_PRIVATE_KEY is not set in .env — cannot deploy. Add the deployer wallet private key and restart." });
    }

    const contractLabel = label || name || "UnnamedContract";

    try {
      const wallet = getDeployerWallet(flowProvider);
      const factory = new ethers.ContractFactory(abi, bytecode, wallet);

      logger.info("ONCHAIN", `[Rishi] Deploying ${contractLabel} to Flow EVM Testnet`, { contractLabel, name, symbol, network: "flow-evm-testnet" });

      // Flow EVM testnet can under-report gas estimates; pad with a fixed limit
      // to prevent "transaction ran out of gas" reverts on large contracts.
      const deployTxReq = await factory.getDeployTransaction(...constructorArgs);
      let gasLimit: bigint;
      try {
        const estimated = await wallet.estimateGas(deployTxReq);
        gasLimit = (estimated * 130n) / 100n; // +30% headroom
      } catch {
        gasLimit = 3_000_000n; // safe fallback for Flow EVM
      }

      const contract = await factory.deploy(...constructorArgs, { gasLimit });
      await contract.waitForDeployment();

      const address = await contract.getAddress();
      const deployTx = contract.deploymentTransaction();
      const txHash = deployTx?.hash ?? "unknown";

      logger.info("ONCHAIN", `[Rishi] Contract deployed: ${contractLabel}`, {
        address,
        txHash,
        gasLimit: gasLimit.toString(),
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
        contractLabel, address, txHash, gasLimit: gasLimit.toString(),
        network: "flow-evm-testnet", chainId: 545,
        explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
        contractUrl: `https://evm-testnet.flowscan.io/address/${address}`,
        proofCid, proofUrl: lighthouseService.getGatewayUrl(proofCid),
        message: `Successfully deployed ${contractLabel} to Flow EVM Testnet at ${address}`,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err ?? 'Unknown error');
      logger.error("ONCHAIN", `[Rishi] Deployment failed: ${contractLabel}`, { error: errMsg, contractLabel, network: "flow-evm-testnet" });
      return JSON.stringify({ error: `Deployment failed: ${errMsg}` });
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
