import { Tool } from "@langchain/core/tools";
import { ethers } from "ethers";
import { filecoinService } from "../services/filecoin";
import { flowService } from "../services/flow";
import { flowProvider, getDeployerWallet } from "../config/chains";
import { config } from "../config/env";
import { logger } from "../services/logger";

export class VerifyAgentIdentityTool extends Tool {
  name = "verify_agent_identity";
  description =
    "Verify an agent's ERC-8004 identity on Filecoin. Input: JSON with 'agentId' (number). Returns verification result.";

  async _call(input: string): Promise<string> {
    let agentId = 0;
    try { agentId = JSON.parse(input).agentId || parseInt(input); } catch {}
    const verified = await filecoinService.verifyAgent(agentId);
    return JSON.stringify({ agentId, verified, timestamp: new Date().toISOString() });
  }
}

export class PrepareTxTool extends Tool {
  name = "prepare_transaction";
  description =
    "Prepare a transaction for user approval and fetch live on-chain context (deployer balance, current block). Input: JSON with 'action' (e.g. 'mint_vtg', 'send_tip', 'mint_nft') and 'params' (recipient, amount). Returns tx data with real on-chain context ready for approval.";

  async _call(input: string): Promise<string> {
    let data: { action?: string; params?: Record<string, unknown> } = {};
    try { data = JSON.parse(input); } catch {}

    const [blockNumber, deployerBalance] = await Promise.all([
      flowProvider.getBlockNumber(),
      flowService.getBalance(getDeployerWallet(flowProvider).address),
    ]);

    const txData = flowService.prepareTxData(data.action || "unknown", data.params || {});
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

export class ExecuteSwapTool extends Tool {
  name = "execute_swap";
  description =
    "Execute an on-chain action on Flow EVM Testnet using the deployer wallet. Supports: minting VTG tokens to a recipient ('action': 'mint_vtg'), sending an ETH tip ('action': 'send_tip'), or minting an NFT ('action': 'mint_nft'). Input: JSON with 'action', 'recipient' (address), 'amount' (string, e.g. '100' for tokens or '0.001' for ETH). Returns txHash and FlowScan explorer URL.";

  async _call(input: string): Promise<string> {
    let params: {
      action?: string;
      fromToken?: string;
      toToken?: string;
      recipient?: string;
      amount?: string;
    } = {};

    try {
      params = JSON.parse(input);
    } catch {
      return JSON.stringify({ error: "Invalid JSON input" });
    }

    const { action, recipient, amount, toToken } = params;
    const deployerAddress = getDeployerWallet(flowProvider).address;
    const to = recipient || deployerAddress;

    // Determine action from explicit 'action' field or infer from token fields
    const resolvedAction =
      action ||
      (toToken?.toUpperCase() === "VTG" ? "mint_vtg" : "send_tip");

    try {
      if (resolvedAction === "mint_vtg" || resolvedAction === "mint_token") {
        const amountNum = parseFloat(amount || "100");
        if (isNaN(amountNum) || amountNum <= 0) {
          return JSON.stringify({ error: "Invalid amount — provide a positive number of VTG tokens to mint" });
        }
        const amountWei = BigInt(Math.floor(amountNum * 1e18));
        logger.info("ONCHAIN", "[Harper] mintToken: minting VTG tokens", { action: "mint_vtg", recipient: to, amount: `${amountNum} VTG`, network: "flow-evm-testnet" });
        const txHash = await flowService.mintToken(to, amountWei);
        logger.info("ONCHAIN", "[Harper] mintToken: success", { txHash, recipient: to, amount: `${amountNum} VTG`, explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}` });

        return JSON.stringify({
          success: true,
          action: "mint_vtg",
          recipient: to,
          amount: `${amountNum} VTG`,
          txHash,
          explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
          contractUrl: `https://evm-testnet.flowscan.io/address/${config.SAMPLE_TOKEN_ADDRESS}`,
          network: "flow-evm-testnet",
          message: `Minted ${amountNum} VTG tokens to ${to} on Flow EVM Testnet`,
        });
      }

      if (resolvedAction === "mint_nft") {
        const tokenURI = (params as any).tokenURI || `https://vantage-labs.io/nft/${Date.now()}`;
        logger.info("ONCHAIN", "[Harper] mintNFT: minting NFT", { action: "mint_nft", recipient: to, tokenURI, network: "flow-evm-testnet" });
        const { txHash, tokenId } = await flowService.mintNFT(to, tokenURI);
        logger.info("ONCHAIN", "[Harper] mintNFT: success", { txHash, tokenId: tokenId.toString(), recipient: to, explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}` });

        return JSON.stringify({
          success: true,
          action: "mint_nft",
          recipient: to,
          tokenId: tokenId.toString(),
          txHash,
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

      // Verify deployer has enough balance
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
        success: true,
        action: "send_tip",
        recipient: to,
        amount: `${amountETH} ETH`,
        txHash,
        explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
        network: "flow-evm-testnet",
        message: `Sent ${amountETH} ETH tip to ${to} on Flow EVM Testnet`,
      });
    } catch (err) {
      logger.error("ONCHAIN", "[Harper] On-chain action failed", { action: resolvedAction, error: (err as Error).message, network: "flow-evm-testnet" });
      return JSON.stringify({ error: (err as Error).message });
    }
  }
}
