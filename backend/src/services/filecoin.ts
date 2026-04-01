import { ethers } from "ethers";
import { config } from "../config/env";
import { filecoinProvider, getDeployerWallet } from "../config/chains";
import IdentityRegistryABI from "../../contracts/abis/IdentityRegistry.json";
import ReputationRegistryABI from "../../contracts/abis/ReputationRegistry.json";
import VantageAgentRegistryABI from "../../contracts/abis/VantageAgentRegistry.json";
import { logger } from "./logger";

class FilecoinService {
  private identityRegistry: ethers.Contract;
  private reputationRegistry: ethers.Contract;
  private vantageRegistry: ethers.Contract;

  private static isValidKey(key: string): boolean {
    return !!key && /^(0x)?[0-9a-fA-F]{64}$/.test(key);
  }

  constructor() {
    const wallet = FilecoinService.isValidKey(config.DEPLOYER_PRIVATE_KEY) ? getDeployerWallet(filecoinProvider) : filecoinProvider as any;

    this.identityRegistry = new ethers.Contract(
      config.IDENTITY_REGISTRY_ADDRESS,
      IdentityRegistryABI,
      wallet
    );
    this.reputationRegistry = new ethers.Contract(
      config.REPUTATION_REGISTRY_ADDRESS,
      ReputationRegistryABI,
      wallet
    );
    this.vantageRegistry = new ethers.Contract(
      config.VANTAGE_REGISTRY_ADDRESS,
      VantageAgentRegistryABI,
      wallet
    );
  }

  async verifyAgent(agentId: number): Promise<boolean> {
    try {
      const owner = await this.identityRegistry.ownerOf(agentId);
      return owner !== ethers.ZeroAddress;
    } catch {
      return false;
    }
  }

  async getAgentURI(agentId: number): Promise<string> {
    return this.identityRegistry.tokenURI(agentId);
  }

  async getAgentByName(name: string): Promise<bigint> {
    return this.vantageRegistry.getAgentByName(name);
  }

  async isVantageAgent(agentId: number): Promise<boolean> {
    return this.vantageRegistry.isVantageAgent(agentId);
  }

  async giveFeedback(agentId: number, value: number, tag1: string, tag2: string): Promise<string> {
    const tx = await this.reputationRegistry.giveFeedback(
      agentId, value, 0, tag1, tag2, "", "", ethers.ZeroHash
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async logAction(data: Record<string, unknown>): Promise<void> {
    // Store action log off-chain via Lighthouse; on-chain logging is gas-intensive
    logger.info("ONCHAIN", "FilecoinService.logAction", data);
  }
}

export const filecoinService = new FilecoinService();
