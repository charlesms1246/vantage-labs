import { Tool } from "@langchain/core/tools";
import { lighthouseService } from "../services/lighthouse";

export class StoreOnFilecoinTool extends Tool {
  name = "store_on_filecoin";
  description = "Store data/documents on Filecoin via Lighthouse. Input: JSON string of data to store. Returns CID.";

  async _call(input: string): Promise<string> {
    const cid = await lighthouseService.upload(input);
    return JSON.stringify({ cid, url: lighthouseService.getGatewayUrl(cid) });
  }
}
