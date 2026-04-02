import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { lighthouseService } from "../services/lighthouse";

export class StoreOnFilecoinTool extends StructuredTool {
  name = "store_on_filecoin";
  description = "Store data/documents on Filecoin via Lighthouse. Returns CID.";
  schema = z.object({
    data: z.string().describe("Data to store (string or JSON)"),
  });

  async _call({ data }: { data: string }): Promise<string> {
    const cid = await lighthouseService.upload(data);
    return JSON.stringify({ cid, url: lighthouseService.getGatewayUrl(cid) });
  }
}
