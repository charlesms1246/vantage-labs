import { getLLM, ModelType } from "../services/llm";
import { StructuredTool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { logger } from "../services/logger";

const GROQ_FALLBACK: ModelType = "groq"; // llama-3.3-70b-versatile — used when provider returns 4xx

export interface AgentConfig {
  name: string;
  role: string;
  model: ModelType;
  systemPrompt: string;
  tools: StructuredTool[];
}

export interface ToolCallCallback {
  (data: {
    toolName: string;
    toolInput: unknown;
    toolResult: string;
  }): void;
}

const MAX_TOOL_ITERATIONS = 6;

function truncate(value: unknown, maxChars = 500): unknown {
  if (typeof value === "string") {
    return value.length > maxChars
      ? `${value.slice(0, maxChars)}... [+${value.length - maxChars} chars]`
      : value;
  }
  if (typeof value === "object" && value !== null) {
    const s = JSON.stringify(value);
    return s.length > maxChars ? `${s.slice(0, maxChars)}... [+${s.length - maxChars} chars]` : value;
  }
  return value;
}

export abstract class BaseAgent {
  protected name: string;
  protected role: string;
  protected modelType: string;
  protected llm: ReturnType<typeof getLLM>;
  protected tools: StructuredTool[];
  protected systemPrompt: string;
  protected conversationHistory: BaseMessage[] = [];

  constructor(agentConfig: AgentConfig) {
    this.name = agentConfig.name;
    this.role = agentConfig.role;
    this.modelType = agentConfig.model;
    this.tools = agentConfig.tools;
    this.systemPrompt = agentConfig.systemPrompt;
    this.llm = getLLM(agentConfig.model);
  }

  async invoke(input: string, _context?: Record<string, unknown>, onToolCall?: ToolCallCallback): Promise<string> {
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
      const lastHuman = messages.filter(m => m._getType() === "human").at(-1);
      logger.info("LLM", `[${this.name}] Invoking LLM (iter ${iter + 1})`, {
        agent: this.name,
        model: this.modelType,
        messageCount: messages.length,
        inputPreview: truncate(lastHuman?.content?.toString() ?? "", 200),
      });
      let response: Awaited<ReturnType<ReturnType<typeof getLLM>["invoke"]>>;
      try {
        response = await llmWithTools.invoke(messages);
      } catch (err) {
        const msg = String(err);
        // Provider-level failures (403, 429, 5xx) — retry once with Groq fallback
        if (/403|429|500|502|503|Provider returned error/i.test(msg) && this.modelType !== GROQ_FALLBACK) {
          logger.warn("LLM", `[${this.name}] Provider error, falling back to Groq`, {
            agent: this.name, originalModel: this.modelType, error: msg.slice(0, 200),
          });
          const fallbackLlm = getLLM(GROQ_FALLBACK);
          const fallbackLlmWithTools = this.tools.length > 0
            ? (fallbackLlm as any).bindTools(this.tools)
            : fallbackLlm;
          response = await fallbackLlmWithTools.invoke(messages);
        } else {
          throw err;
        }
      }
      const content = typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content.map((c: any) => (typeof c === "string" ? c : c.text || "")).join("")
          : JSON.stringify(response.content);

      // Path 1: Native tool_calls (function calling API)
      const toolCalls = (response as AIMessage).tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        logger.info("LLM", `[${this.name}] LLM response — tool calls`, {
          agent: this.name,
          model: this.modelType,
          toolCallNames: toolCalls.map(tc => tc.name),
        });
        messages.push(response as AIMessage);
        for (const tc of toolCalls) {
          const tool = this.tools.find(t => t.name === tc.name);
          if (tool) {
            // StructuredTool.invoke() expects an object — pass args directly (parse if string)
            const toolArgs = typeof tc.args === "string" ? JSON.parse(tc.args) : (tc.args ?? {});
            logger.info("TOOL", `[${this.name}] Tool call: ${tc.name}`, {
              agent: this.name,
              tool: tc.name,
              args: truncate(toolArgs),
            });
            const result = await tool.invoke(toolArgs);
            logger.info("TOOL", `[${this.name}] Tool result: ${tc.name}`, {
              agent: this.name,
              tool: tc.name,
              resultPreview: truncate(result),
            });
            const resultStr = typeof result === "string" ? result : JSON.stringify(result);
            onToolCall?.({ toolName: tc.name, toolInput: toolArgs, toolResult: resultStr });
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
            // StructuredTool.invoke() expects an object — pass args directly (parse if string)
            const toolArgs = typeof parsed.arguments === "string"
              ? JSON.parse(parsed.arguments)
              : (parsed.arguments ?? {});
            logger.info("TOOL", `[${this.name}] Text tool call: ${parsed.name}`, {
              agent: this.name,
              tool: parsed.name,
              args: truncate(toolArgs),
            });
            const toolResult = await tool.invoke(toolArgs);
            logger.info("TOOL", `[${this.name}] Text tool result: ${parsed.name}`, {
              agent: this.name,
              tool: parsed.name,
              resultPreview: truncate(toolResult),
            });
            const resultStr = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
            onToolCall?.({ toolName: parsed.name, toolInput: toolArgs, toolResult: resultStr });
            messages.push(new AIMessage(content));
            messages.push(new HumanMessage(`Tool result for ${parsed.name}:\n${toolResult}\n\nContinue with the task.`));
            continue;
          }
        } catch {
          // JSON parse failed — treat as plain text response
        }
      }

      // No tool call detected — this is the final response
      logger.info("LLM", `[${this.name}] LLM final response`, {
        agent: this.name,
        model: this.modelType,
        contentPreview: truncate(content),
      });
      lastOutput = content;
      break;
    }

    // If we exhausted iterations without a final response, ask for a summary
    if (!lastOutput) {
      logger.warn("LLM", `[${this.name}] Max iterations reached, requesting summary`, { agent: this.name });
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
