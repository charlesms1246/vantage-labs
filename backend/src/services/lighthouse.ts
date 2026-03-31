import lighthouse from "@lighthouse-web3/sdk";
import { config } from "../config/env";

class LighthouseService {
  async upload(data: string): Promise<string> {
    if (!config.LIGHTHOUSE_API_KEY) {
      console.warn("LIGHTHOUSE_API_KEY not set, skipping upload");
      return "QmSimulatedCID";
    }
    const response = await lighthouse.uploadText(data, config.LIGHTHOUSE_API_KEY);
    return response.data.Hash;
  }

  async getFile(cid: string): Promise<unknown> {
    const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${cid}`);
    return response.json();
  }

  getGatewayUrl(cid: string): string {
    return `https://gateway.lighthouse.storage/ipfs/${cid}`;
  }
}

export const lighthouseService = new LighthouseService();
