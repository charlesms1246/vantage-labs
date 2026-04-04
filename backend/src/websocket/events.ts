export const WS_EVENTS = {
  // Client → Server
  USER_MESSAGE: "user_message",
  APPROVE: "approve",
  REJECT: "reject",

  // Server → Client
  AGENT_THINKING: "agent_thinking",
  AGENT_RESPONSE: "agent_response",
  /** Final prose output from an agent's LLM — shown in Agent Chat */
  AGENT_LLM_OUTPUT: "agent_llm_output",
  /** Real-time backend log entry — shown in Events panel */
  SYSTEM_LOG: "system_log",
  PLAN_READY: "plan_ready",
  EXECUTION_STARTED: "execution_started",
  EXECUTION_COMPLETE: "execution_complete",
  EXECUTION_CANCELLED: "execution_cancelled",
  ERROR: "error",
} as const;
