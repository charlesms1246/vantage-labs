import { BaseAgent } from "./base-agent";
import { getLLM } from "../services/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";
import { SessionState } from "../types";

export class Orchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private llm = getLLM("groq");
  private systemPrompt = `You are the Orchestrator for Vantage Labs, a Decentralized Autonomous Agency.

Your role:
1. Parse user intent from natural language
2. Break complex requests into sub-tasks
3. Identify which specialist agents are needed:
   - Eric (market_analyst): Market analysis, yield opportunities, price data
   - Harper (trader): Trade execution, DeFi operations, token swaps
   - Rishi (developer): Smart contracts, deployments, technical tasks
   - Yasmin (creative): NFT creation, marketing content, metadata
4. Create a clear plan with steps

Always respond with a JSON plan:
{
  "intent": "brief description",
  "agents": ["agent1", "agent2"],
  "steps": [
    { "agent": "Eric", "task": "specific task" },
    { "agent": "Harper", "task": "specific task" }
  ],
  "requiresApproval": true,
  "onChainActions": ["description of what will happen on-chain"]
}`;

  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getName(), agent);
  }

  async processUserRequest(userInput: string, sessionId: string, walletAddress = ""): Promise<SessionState> {
    // 1. Parse intent and create plan
    const planResponse = await this.llm.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(userInput),
    ]);

    let plan: Record<string, unknown>;
    try {
      const content = typeof planResponse.content === "string" ? planResponse.content : "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { intent: content, agents: [], steps: [], requiresApproval: true, onChainActions: [] };
    } catch {
      plan = { intent: userInput, agents: [], steps: [], requiresApproval: true, onChainActions: [] };
    }

    const session: SessionState = {
      sessionId,
      walletAddress,
      messages: [],
      plan: JSON.stringify(plan, null, 2),
      status: "pending_approval",
      results: [],
    };

    return session;
  }

  async executeStep(agentName: string, task: string): Promise<string> {
    // Try exact match first, then case-insensitive match
    let agent = this.agents.get(agentName);
    if (!agent) {
      // Case-insensitive lookup
      const normalizedName = Array.from(this.agents.keys()).find(
        name => name.toLowerCase() === agentName.toLowerCase()
      );
      agent = normalizedName ? this.agents.get(normalizedName) : undefined;
    }
    if (!agent) return `Error: Agent ${agentName} not found`;
    return agent.invoke(task);
  }

  async executePlan(session: SessionState, onProgress?: (update: Record<string, unknown>) => void): Promise<SessionState> {
    const plan = JSON.parse(session.plan);
    const results: unknown[] = [];

    for (const step of (plan.steps || [])) {
      onProgress?.({ agent: step.agent, task: step.task, status: "executing" });
      const result = await this.executeStep(step.agent, step.task);
      results.push({ agent: step.agent, task: step.task, result });
      onProgress?.({ agent: step.agent, task: step.task, status: "complete", result });
    }

    return { ...session, results, status: "complete" };
  }

  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }
}
