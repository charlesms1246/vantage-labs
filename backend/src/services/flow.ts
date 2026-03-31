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
}

export const flowService = new FlowService();
