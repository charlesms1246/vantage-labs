import { getLLM, ModelType } from "../services/llm";
import { Tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

export interface AgentConfig {
  name: string;
  role: string;
  model: ModelType;
  systemPrompt: string;
  tools: Tool[];
}

export abstract class BaseAgent {
  protected name: string;
  protected role: string;
  protected llm: ReturnType<typeof getLLM>;
  protected tools: Tool[];
  protected systemPrompt: string;
  protected conversationHistory: BaseMessage[] = [];

  constructor(agentConfig: AgentConfig) {
    this.name = agentConfig.name;
    this.role = agentConfig.role;
    this.tools = agentConfig.tools;
    this.systemPrompt = agentConfig.systemPrompt;
    this.llm = getLLM(agentConfig.model);
  }

  async invoke(input: string, _context?: Record<string, unknown>): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt),
      ...this.conversationHistory,
      new HumanMessage(input),
    ];

    // Simple tool-aware invocation: try tools if input suggests tool use
    for (const tool of this.tools) {
      if (input.toLowerCase().includes(tool.name.replace(/_/g, " ").toLowerCase())) {
        const result = await tool.invoke(input);
        this.conversationHistory.push(new HumanMessage(input));
        this.conversationHistory.push(new AIMessage(`Tool ${tool.name} result: ${result}`));
        return result;
      }
    }

    const response = await this.llm.invoke(messages);
    const output = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

    this.conversationHistory.push(new HumanMessage(input));
    this.conversationHistory.push(new AIMessage(output));

    // Keep history bounded
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    return output;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getName(): string { return this.name; }
  getRole(): string { return this.role; }
}
