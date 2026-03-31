import { Tool } from "@langchain/core/tools";
import { lighthouseService } from "../services/lighthouse";

export class CreateNFTMetadataTool extends Tool {
  name = "create_nft_metadata";
  description = "Create NFT metadata JSON. Input: JSON with 'name', 'description', 'imageCID' fields. Returns metadata CID.";

  async _call(input: string): Promise<string> {
    const { name, description, imageCID } = JSON.parse(input);
    const metadata = {
      name,
      description,
      image: `ipfs://${imageCID}`,
      attributes: [],
      created_by: "Yasmin - Vantage Labs",
    };
    const cid = await lighthouseService.upload(JSON.stringify(metadata));
    return JSON.stringify({ cid, metadata, url: lighthouseService.getGatewayUrl(cid) });
  }
}

export class UploadToFilecoinTool extends Tool {
  name = "upload_to_filecoin";
  description = "Upload content to Filecoin via Lighthouse. Input: string content or JSON. Returns CID.";

  async _call(input: string): Promise<string> {
    const cid = await lighthouseService.upload(input);
    return JSON.stringify({ cid, url: lighthouseService.getGatewayUrl(cid) });
  }
}

export class CreateTweetTool extends Tool {
  name = "create_tweet";
  description = "Generate a marketing tweet. Input: JSON with 'context' field. Returns tweet text.";

  async _call(input: string): Promise<string> {
    let context = input;
    try { context = JSON.parse(input).context || input; } catch {}
    return JSON.stringify({
      tweet: `🚀 Exciting news from Vantage Labs! ${context} #Web3 #DeFi #Flow #Filecoin #DAA`,
      charCount: 280,
    });
  }
}
