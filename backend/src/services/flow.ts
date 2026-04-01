import { ethers } from "ethers";
import { config } from "../config/env";
import { flowProvider, getDeployerWallet } from "../config/chains";
import SampleTokenABI from "../../contracts/abis/SampleToken.json";
import SampleNFTABI from "../../contracts/abis/SampleNFT.json";
import TippingContractABI from "../../contracts/abis/TippingContract.json";

class FlowService {
  private sampleToken: ethers.Contract;
  private sampleNFT: ethers.Contract;
  private tippingContract: ethers.Contract;
  private wallet: ethers.Wallet;

  private static isValidKey(key: string): boolean {
    return !!key && /^(0x)?[0-9a-fA-F]{64}$/.test(key);
  }

  constructor() {
    this.wallet = FlowService.isValidKey(config.DEPLOYER_PRIVATE_KEY)
      ? getDeployerWallet(flowProvider)
      : new ethers.Wallet(ethers.Wallet.createRandom().privateKey, flowProvider);

    this.sampleToken = new ethers.Contract(config.SAMPLE_TOKEN_ADDRESS, SampleTokenABI, this.wallet);
    this.sampleNFT = new ethers.Contract(config.SAMPLE_NFT_ADDRESS, SampleNFTABI, this.wallet);
    this.tippingContract = new ethers.Contract(config.TIPPING_CONTRACT_ADDRESS, TippingContractABI, this.wallet);
  }

  async mintToken(to: string, amount: bigint): Promise<string> {
    const tx = await this.sampleToken.mint(to, amount);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async mintNFT(to: string, tokenURI: string): Promise<{ tokenId: bigint; txHash: string }> {
    const tx = await this.sampleNFT.mint(to, tokenURI);
    const receipt = await tx.wait();
    return { tokenId: 0n, txHash: receipt.hash };
  }

  async sendTip(creator: string, amount: bigint): Promise<string> {
    const tx = await this.tippingContract.tip(creator, { value: amount });
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getBalance(address: string): Promise<bigint> {
    return flowProvider.getBalance(address);
  }

  prepareTxData(action: string, params: Record<string, unknown>): Record<string, unknown> {
    return { action, params, network: "flow-evm-testnet", chainId: 545 };
  }

  /**
   * Records a Lighthouse/IPFS CID on-chain by minting an NFT on SampleNFT.
   * The tokenURI is set to the Lighthouse gateway URL so the proof is:
   *  - An indexed ERC-721 Transfer event visible on FlowScan
   *  - Queryable by tokenId and tokenURI
   *  - Directly linked to the Lighthouse IPFS file
   * Returns { txHash, tokenId, explorerUrl }.
   */
  async recordProofOnChain(
    cid: string,
    _label = "vantage-session-log"
  ): Promise<{ txHash: string; tokenId: string; explorerUrl: string }> {
    const tokenURI = `https://gateway.lighthouse.storage/ipfs/${cid}`;
    const to = await this.wallet.getAddress();

    const tx = await this.sampleNFT.mint(to, tokenURI);
    const receipt = await tx.wait();
    const txHash: string = receipt?.hash ?? tx.hash;

    // Parse tokenId from Transfer event (from=0x0 is a mint)
    let tokenId = "0";
    try {
      const iface = new ethers.Interface([
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      ]);
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.name === "Transfer") {
            tokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch {}
      }
    } catch {}

    return {
      txHash,
      tokenId,
      explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
    };
  }
}

export const flowService = new FlowService();
