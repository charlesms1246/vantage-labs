import { BaseAgent } from "./base-agent";
import { getLLM } from "../services/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";
import { SessionState } from "../types";
import { logger } from "../services/logger";

export class Orchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private llm = getLLM("groq");
  private systemPrompt = `You are the Orchestrator for Vantage Labs, a Decentralized Autonomous Agency (DAA) on Flow EVM Testnet.

Your role:
1. Parse the user's intent precisely
2. Break the task into an ordered sequence of agent steps
3. Design steps so each agent's OUTPUT feeds into the NEXT agent's INPUT — agents collaborate, not work in isolation
4. Agents available:
   - Eric (market_analyst): market analysis, yield opportunities, DeFi data, price trends
   - Harper (trader): DeFi execution, token swaps, transaction preparation
   - Rishi (developer): smart contract generation + deployment to Flow EVM, technical tasks
   - Yasmin (creative): NFT image generation (Gemini), NFT metadata creation, marketing, Filecoin uploads

IMPORTANT RULES:
- Agents SPEAK TO EACH OTHER, not to the user. Task strings should be addressed as "Hey [AgentName],"
- For contract deployment: ALWAYS include Rishi with TWO steps: first generate_contract, then deploy_contract
- For NFT work: Yasmin generates the image first, then Rishi deploys the NFT contract
- Each step's task description MUST explicitly say what output from the previous step to use
- The task must be fully completed on-chain where applicable

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "intent": "one-line description of what will be accomplished",
  "agents": ["AgentName1", "AgentName2"],
  "steps": [
    {
      "agent": "Eric",
      "task": "Hey Eric, analyze the memecoin market on Flow EVM and provide a recommendation for launching a new token. Include suggested name, symbol, and initial supply."
    },
    {
      "agent": "Rishi",
      "task": "Hey Rishi, using Eric's market analysis, generate the ERC20 contract for the recommended memecoin using generate_contract, then immediately deploy it to Flow EVM Testnet using deploy_contract."
    }
  ],
  "requiresApproval": true,
  "onChainActions": ["Deploy ERC20 token contract to Flow EVM Testnet"]
}`;

  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getName(), agent);
  }

  async processUserRequest(userInput: string, sessionId: string, walletAddress = ""): Promise<SessionState> {
    logger.info("LLM", "[Orchestrator] Generating plan", {
      agent: "Orchestrator",
      model: "groq/llama-3.3-70b-versatile",
      sessionId,
      inputPreview: userInput.slice(0, 200),
    });
    const planResponse = await this.llm.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(userInput),
    ]);

    let plan: Record<string, unknown>;
    try {
      const content = typeof planResponse.content === "string" ? planResponse.content : "";
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      plan = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        intent: content,
        agents: [],
        steps: [],
        requiresApproval: true,
        onChainActions: [],
      };
    } catch {
      plan = {
        intent: userInput,
        agents: [],
        steps: [],
        requiresApproval: true,
        onChainActions: [],
      };
    }

    logger.info("LLM", "[Orchestrator] Plan generated", {
      intent: plan.intent,
      agents: plan.agents,
      stepCount: Array.isArray(plan.steps) ? plan.steps.length : 0,
      requiresApproval: plan.requiresApproval,
      onChainActions: plan.onChainActions,
    });

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
    let agent = this.agents.get(agentName);
    if (!agent) {
      const normalizedName = Array.from(this.agents.keys()).find(
        name => name.toLowerCase() === agentName.toLowerCase()
      );
      agent = normalizedName ? this.agents.get(normalizedName) : undefined;
    }
    if (!agent) return `Error: Agent ${agentName} not found`;
    return agent.invoke(task);
  }

  async executePlan(
    session: SessionState,
    onProgress?: (update: Record<string, unknown>) => void
  ): Promise<SessionState> {
    const plan = JSON.parse(session.plan);
    const results: unknown[] = [];

    // Accumulate a shared context string — each agent's output is visible to the next
    let sharedContext = "";

    const steps = plan.steps || [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      logger.info("SYSTEM", `[Orchestrator] Step ${i + 1}/${steps.length}: ${step.agent}`, {
        agent: step.agent,
        taskPreview: step.task.slice(0, 150),
      });
      onProgress?.({ agent: step.agent, task: step.task, status: "executing" });

      // Enrich the task with context from previous steps
      const enrichedTask = sharedContext
        ? `${step.task}\n\n--- Context from previous agents ---\n${sharedContext}\n--- End context ---`
        : step.task;

      const result = await this.executeStep(step.agent, enrichedTask);
      results.push({ agent: step.agent, task: step.task, result });

      // Append this agent's output to the shared context for subsequent steps
      sharedContext += `\n\n[${step.agent}]: ${result}`;

      logger.info("SYSTEM", `[Orchestrator] Step ${i + 1}/${steps.length} complete: ${step.agent}`, {
        agent: step.agent,
        resultPreview: result.slice(0, 200),
      });
      onProgress?.({
        agent: step.agent,
        task: step.task,
        status: "complete",
        result,
        // Include partial context so frontend can show richer output
        contextSoFar: sharedContext.trim(),
      });
    }

    return { ...session, results, status: "complete" };
  }

  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }
}
