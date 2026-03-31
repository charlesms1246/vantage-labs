import { Tool } from "@langchain/core/tools";
import { filecoinService } from "../services/filecoin";
import { flowService } from "../services/flow";

export class VerifyAgentIdentityTool extends Tool {
  name = "verify_agent_identity";
  description = "Verify an agent's ERC-8004 identity on Filecoin. Input: JSON with 'agentId' (number). Returns verification result.";

  async _call(input: string): Promise<string> {
    let agentId = 0;
    try { agentId = JSON.parse(input).agentId || parseInt(input); } catch {}
    const verified = await filecoinService.verifyAgent(agentId);
    return JSON.stringify({ agentId, verified, timestamp: new Date().toISOString() });
  }
}

export class PrepareTxTool extends Tool {
  name = "prepare_transaction";
  description = "Prepare a transaction for user approval. Input: JSON with 'action' and 'params'. Returns tx data for approval modal.";

  async _call(input: string): Promise<string> {
    const data = JSON.parse(input);
    const txData = flowService.prepareTxData(data.action, data.params);
    return JSON.stringify({ ...txData, status: "pending_approval", requiresUserSignature: true });
  }
}

export class ExecuteSwapTool extends Tool {
  name = "execute_swap";
  description = "Execute a token swap on Flow EVM (requires prior user approval). Input: JSON with 'fromToken', 'toToken', 'amount'.";

  async _call(input: string): Promise<string> {
    const { fromToken, toToken, amount } = JSON.parse(input);
    // In production, this would call a DEX router
    return JSON.stringify({
      status: "simulated",
      fromToken, toToken, amount,
      message: "Swap simulation — DEX integration pending",
    });
  }
}
