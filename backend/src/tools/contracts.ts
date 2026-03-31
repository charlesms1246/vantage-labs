import { Tool } from "@langchain/core/tools";
import { lighthouseService } from "../services/lighthouse";

export class GenerateContractTool extends Tool {
  name = "generate_contract";
  description = "Generate Solidity smart contract code from a specification. Input: JSON with 'spec' field describing the contract.";

  async _call(input: string): Promise<string> {
    let spec = input;
    try { spec = JSON.parse(input).spec || input; } catch {}
    // Template-based generation — Claude model does the heavy lifting via LLM
    return JSON.stringify({
      spec,
      template: "ERC20",
      solidity: "// Generated contract based on spec\n// Full implementation via Rishi's model",
      note: "Rishi uses Claude 3.5 Sonnet for actual code generation via LLM response",
    });
  }
}

export class StoreProofTool extends Tool {
  name = "store_proof";
  description = "Store compilation proof on Filecoin. Input: JSON with 'bytecode' and 'metadata'. Returns CID.";

  async _call(input: string): Promise<string> {
    const cid = await lighthouseService.upload(input);
    return JSON.stringify({ cid, stored: true, url: lighthouseService.getGatewayUrl(cid) });
  }
}
