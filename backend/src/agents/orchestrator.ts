import { BaseAgent, ToolCallCallback } from "./base-agent";
import { getLLM } from "../services/llm";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
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
- If context is provided from previous conversation turns, USE it to adapt your plan.
- If the user is just chatting or modifying a previous request, formulate a new appropriate plan.

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

  async processUserRequest(
    userInput: string, 
    sessionId: string, 
    walletAddress = "",
    chatHistory: { role: "user" | "assistant"; content: string }[] = []
  ): Promise<SessionState> {
    const contextualSystemPrompt = `${this.systemPrompt}

User Memory / Context:
- Connected Wallet Address: ${walletAddress || "Not connected"}
- Session ID: ${sessionId}

Crucial Interaction Rule:
If an agent or step requires user input or missing information (e.g. they need a wallet address and it says "Not connected"), DO NOT generate a plan with random assumptions or fake addresses. 
Instead, output a JSON plan with NO steps and use the 'intent' field to directly ask the user for the specific missing information. This intent string will be shown to the user in the Agent Chat tab. E.g.:
{
  "intent": "I need your receiving wallet address to proceed with the transfer.",
  "agents": [],
  "steps": [],
  "requiresApproval": false,
  "onChainActions": []
}`;

    logger.info("LLM", "[Orchestrator] Generating plan", {
      agent: "Orchestrator",
      model: "groq/llama-3.3-70b-versatile",
      sessionId,
      inputPreview: userInput.slice(0, 200),
      historyLength: chatHistory.length,
    });

    const messages = [
      new SystemMessage(contextualSystemPrompt),
      ...chatHistory.map(m => m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)),
      new HumanMessage(userInput),
    ];

    const planResponse = await this.llm.invoke(messages);

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
      chatHistory,
      plan: JSON.stringify(plan, null, 2),
      status: "pending_approval",
      results: [],
    };

    return session;
  }

  async executeStep(agentName: string, task: string, onToolCall?: ToolCallCallback): Promise<string> {
    let agent = this.agents.get(agentName);
    if (!agent) {
      const normalizedName = Array.from(this.agents.keys()).find(
        name => name.toLowerCase() === agentName.toLowerCase()
      );
      agent = normalizedName ? this.agents.get(normalizedName) : undefined;
    }
    if (!agent) return `Error: Agent ${agentName} not found`;
    return agent.invoke(task, undefined, onToolCall);
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

      // Enrich the task with context from previous steps and explicitly pass the user wallet
      const walletContext = `\n--- Global Context ---\nUser Wallet Address: ${session.walletAddress || "Not connected"}\n----------------------\n`;
      const enrichedTask = sharedContext
        ? `${step.task}\n${walletContext}\n--- Context from previous agents ---\n${sharedContext}\n--- End context ---`
        : `${step.task}\n${walletContext}`;

      const onToolCall: ToolCallCallback = ({ toolName, toolInput, toolResult }) => {
        onProgress?.({ agent: step.agent, toolName, toolInput, toolResult, status: "tool_use" });
      };

      let result: string;
      try {
        result = await this.executeStep(step.agent, enrichedTask, onToolCall);
      } catch (stepErr) {
        const errMsg = stepErr instanceof Error ? stepErr.message : String(stepErr ?? "Unknown error");
        result = `[⚠️  Error in step ${i + 1} (${step.agent}): ${errMsg}. Continuing with next step.]`;
        logger.error("SYSTEM", `[Orchestrator] Step ${i + 1}/${steps.length} failed (resilient): ${step.agent}`, {
          agent: step.agent,
          error: errMsg,
        });
        onProgress?.({
          agent: step.agent,
          task: step.task,
          status: "error",
          result,
        });
      }

      results.push({ agent: step.agent, task: step.task, result });

      // Append this agent's output to the shared context for subsequent steps
      sharedContext += `\n\n[${step.agent}]: ${result}`;

      if (!result.includes("⚠️  Error")) {
        logger.info("SYSTEM", `[Orchestrator] Step ${i + 1}/${steps.length} complete: ${step.agent}`, {
          agent: step.agent,
          resultPreview: result.slice(0, 200),
        });
      }
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
