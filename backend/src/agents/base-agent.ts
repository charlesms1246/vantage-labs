import { getLLM, ModelType } from "../services/llm";
import { Tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";

export interface AgentConfig {
  name: string;
  role: string;
  model: ModelType;
  systemPrompt: string;
  tools: Tool[];
}

const MAX_TOOL_ITERATIONS = 6;

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
    const toolInstructions = this.buildToolInstructions();
    const messages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt + toolInstructions),
      ...this.conversationHistory,
      new HumanMessage(input),
    ];

    let lastOutput = "";

    // Try to bind tools for native function calling (supported by most OpenAI-compatible endpoints)
    let llmWithTools: ReturnType<typeof getLLM>;
    try {
      llmWithTools = this.tools.length > 0
        ? (this.llm as any).bindTools(this.tools)
        : this.llm;
    } catch {
      llmWithTools = this.llm;
    }

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const response = await llmWithTools.invoke(messages);
      const content = typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content.map((c: any) => (typeof c === "string" ? c : c.text || "")).join("")
          : JSON.stringify(response.content);

      // Path 1: Native tool_calls (function calling API)
      const toolCalls = (response as AIMessage).tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        messages.push(response as AIMessage);
        for (const tc of toolCalls) {
          const tool = this.tools.find(t => t.name === tc.name);
          if (tool) {
            const args = typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args ?? {});
            console.log(`[${this.name}] Calling tool: ${tc.name} with args: ${args}`);
            const result = await tool.invoke(args);
            console.log(`[${this.name}] Tool ${tc.name} result: ${result.slice(0, 200)}...`);
            messages.push(new ToolMessage({ content: result, tool_call_id: tc.id ?? `call_${iter}` }));
          }
        }
        continue; // let LLM process tool results
      }

      // Path 2: Text-based <tool_call> parsing (fallback for models without native function calling)
      const toolCallMatch = content.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);
      if (toolCallMatch) {
        try {
          const parsed = JSON.parse(toolCallMatch[1]);
          const tool = this.tools.find(t => t.name === parsed.name);
          if (tool) {
            const args = typeof parsed.arguments === "string"
              ? parsed.arguments
              : JSON.stringify(parsed.arguments ?? {});
            console.log(`[${this.name}] Text-based tool call: ${parsed.name}`);
            const toolResult = await tool.invoke(args);
            console.log(`[${this.name}] Tool ${parsed.name} result: ${toolResult.slice(0, 200)}...`);
            messages.push(new AIMessage(content));
            messages.push(new HumanMessage(`Tool result for ${parsed.name}:\n${toolResult}\n\nContinue with the task.`));
            continue;
          }
        } catch {
          // JSON parse failed — treat as plain text response
        }
      }

      // No tool call detected — this is the final response
      lastOutput = content;
      break;
    }

    // If we exhausted iterations without a final response, ask for a summary
    if (!lastOutput) {
      const summaryResponse = await this.llm.invoke([
        ...messages,
        new HumanMessage("Provide a final summary of what was accomplished and the key results."),
      ]);
      lastOutput = typeof summaryResponse.content === "string"
        ? summaryResponse.content
        : JSON.stringify(summaryResponse.content);
    }

    this.conversationHistory.push(new HumanMessage(input));
    this.conversationHistory.push(new AIMessage(lastOutput));

    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    return lastOutput;
  }

  /**
   * Builds the tool usage instructions appended to the system prompt.
   * Ensures models that don't support native function calling can still use tools.
   */
  private buildToolInstructions(): string {
    if (this.tools.length === 0) return "";

    const toolList = this.tools
      .map(t => `  - **${t.name}**: ${t.description}`)
      .join("\n");

    return `

## Tools Available
${toolList}

To call a tool, include a tool call block anywhere in your response:
<tool_call>
{"name": "tool_name", "arguments": {"key": "value"}}
</tool_call>

After receiving tool results, continue working. Chain multiple tool calls if needed (e.g., generate_contract → deploy_contract). Provide a clear final answer once all tool calls are complete.`;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getName(): string { return this.name; }
  getRole(): string { return this.role; }
}
