import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ethers } from "ethers";
import { filecoinService } from "../services/filecoin";
import { flowService } from "../services/flow";
import { flowProvider, getDeployerWallet } from "../config/chains";
import { config } from "../config/env";
import { logger } from "../services/logger";

export class VerifyAgentIdentityTool extends StructuredTool {
  name = "verify_agent_identity";
  description = "Verify an agent's ERC-8004 identity on Filecoin. Returns verification result.";
  schema = z.object({
    agentId: z.number().describe("Numeric agent ID to verify"),
  });

  async _call({ agentId }: { agentId: number }): Promise<string> {
    const verified = await filecoinService.verifyAgent(agentId);
    return JSON.stringify({ agentId, verified, timestamp: new Date().toISOString() });
  }
}

export class PrepareTxTool extends StructuredTool {
  name = "prepare_transaction";
  description =
    "Prepare a transaction for user approval and fetch live on-chain context (deployer balance, current block). Returns tx data with real on-chain context ready for approval.";
  schema = z.object({
    action: z.string().describe("Action to perform, e.g. 'mint_vtg', 'send_tip', 'mint_nft'"),
    params: z.record(z.string(), z.unknown()).optional().describe("Action parameters such as recipient address and amount"),
  });

  async _call({ action, params = {} }: { action: string; params?: Record<string, unknown> }): Promise<string> {
    const [blockNumber, deployerBalance] = await Promise.all([
      flowProvider.getBlockNumber(),
      flowService.getBalance(getDeployerWallet(flowProvider).address),
    ]);

    const txData = flowService.prepareTxData(action, params);
    return JSON.stringify({
      ...txData,
      onChainContext: {
        currentBlock: blockNumber,
        deployerBalanceETH: ethers.formatEther(deployerBalance),
        network: "flow-evm-testnet",
        chainId: 545,
      },
      status: "pending_approval",
      requiresUserSignature: true,
    });
  }
}

export class ExecuteSwapTool extends StructuredTool {
  name = "execute_swap";
  description =
    "Execute an on-chain action on Flow EVM Testnet using the deployer wallet. Supports minting VTG tokens ('mint_vtg'), sending an ETH tip ('send_tip'), or minting an NFT ('mint_nft').";
  schema = z.object({
    action: z.enum(["mint_vtg", "mint_token", "send_tip", "mint_nft"]).describe("On-chain action to execute"),
    recipient: z.string().optional().describe("Recipient wallet address"),
    amount: z.string().optional().describe("Amount — token count for mint_vtg, ETH for send_tip (e.g. '100' or '0.001')"),
    tokenURI: z.string().optional().describe("Token URI for mint_nft action"),
  });

  async _call({ action, recipient, amount, tokenURI }: {
    action: string;
    recipient?: string;
    amount?: string;
    tokenURI?: string;
  }): Promise<string> {
    const deployerAddress = getDeployerWallet(flowProvider).address;
    const to = recipient || deployerAddress;

    try {
      if (action === "mint_vtg" || action === "mint_token") {
        const amountNum = parseFloat(amount || "100");
        if (isNaN(amountNum) || amountNum <= 0) {
          return JSON.stringify({ error: "Invalid amount — provide a positive number of VTG tokens to mint" });
        }
        const amountWei = BigInt(Math.floor(amountNum * 1e18));
        logger.info("ONCHAIN", "[Harper] mintToken: minting VTG tokens", { action: "mint_vtg", recipient: to, amount: `${amountNum} VTG`, network: "flow-evm-testnet" });
        const txHash = await flowService.mintToken(to, amountWei);
        logger.info("ONCHAIN", "[Harper] mintToken: success", { txHash, recipient: to, amount: `${amountNum} VTG`, explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}` });

        return JSON.stringify({
          success: true, action: "mint_vtg", recipient: to, amount: `${amountNum} VTG`, txHash,
          explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
          contractUrl: `https://evm-testnet.flowscan.io/address/${config.SAMPLE_TOKEN_ADDRESS}`,
          network: "flow-evm-testnet",
          message: `Minted ${amountNum} VTG tokens to ${to} on Flow EVM Testnet`,
        });
      }

      if (action === "mint_nft") {
        const uri = tokenURI || `https://vantage-labs.io/nft/${Date.now()}`;
        logger.info("ONCHAIN", "[Harper] mintNFT: minting NFT", { action: "mint_nft", recipient: to, tokenURI: uri, network: "flow-evm-testnet" });
        const { txHash, tokenId } = await flowService.mintNFT(to, uri);
        logger.info("ONCHAIN", "[Harper] mintNFT: success", { txHash, tokenId: tokenId.toString(), recipient: to, explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}` });

        return JSON.stringify({
          success: true, action: "mint_nft", recipient: to,
          tokenId: tokenId.toString(), txHash,
          explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
          network: "flow-evm-testnet",
          message: `Minted VNFT #${tokenId} to ${to} on Flow EVM Testnet`,
        });
      }

      // Default: send_tip (ETH transfer via TippingContract)
      const amountETH = parseFloat(amount || "0.001");
      if (isNaN(amountETH) || amountETH <= 0) {
        return JSON.stringify({ error: "Invalid amount — provide a positive ETH amount for the tip" });
      }

      const deployerBalance = await flowService.getBalance(deployerAddress);
      const amountWei = BigInt(Math.floor(amountETH * 1e18));
      if (deployerBalance < amountWei) {
        return JSON.stringify({
          error: `Insufficient deployer balance: ${ethers.formatEther(deployerBalance)} ETH available, ${amountETH} ETH requested`,
        });
      }

      logger.info("ONCHAIN", "[Harper] sendTip: sending ETH tip", { action: "send_tip", recipient: to, amount: `${amountETH} ETH`, network: "flow-evm-testnet" });
      const txHash = await flowService.sendTip(to, amountWei);
      logger.info("ONCHAIN", "[Harper] sendTip: success", { txHash, recipient: to, amount: `${amountETH} ETH`, explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}` });

      return JSON.stringify({
        success: true, action: "send_tip", recipient: to, amount: `${amountETH} ETH`, txHash,
        explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
        network: "flow-evm-testnet",
        message: `Sent ${amountETH} ETH tip to ${to} on Flow EVM Testnet`,
      });
    } catch (err) {
      logger.error("ONCHAIN", "[Harper] On-chain action failed", { action, error: (err as Error).message, network: "flow-evm-testnet" });
      return JSON.stringify({ error: (err as Error).message });
    }
  }
}
