export interface AgentMessage {
  from: string;
  to: string;
  taskId: string;
  type: "request" | "response" | "handoff";
  payload: {
    action: string;
    params: Record<string, unknown>;
  };
  timestamp: string;
  sessionId: string;
}

export interface SessionState {
  sessionId: string;
  walletAddress: string;
  messages: AgentMessage[];
  plan: string;
  status: "idle" | "planning" | "pending_approval" | "executing" | "complete" | "cancelled";
  results: unknown[];
  logCid?: string;
}

export interface AgentConfig {
  name: string;
  role: string;
  model: "groq" | "gemini" | "claude";
  systemPrompt: string;
}

export interface OnChainAction {
  type: "swap" | "mint" | "deploy" | "tip" | "transfer";
  params: Record<string, unknown>;
  estimatedGas?: string;
  description: string;
}
