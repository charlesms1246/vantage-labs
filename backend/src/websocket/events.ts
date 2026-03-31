export const WS_EVENTS = {
  // Client → Server
  USER_MESSAGE: "user_message",
  APPROVE: "approve",
  REJECT: "reject",

  // Server → Client
  AGENT_THINKING: "agent_thinking",
  AGENT_RESPONSE: "agent_response",
  PLAN_READY: "plan_ready",
  EXECUTION_STARTED: "execution_started",
  EXECUTION_COMPLETE: "execution_complete",
  EXECUTION_CANCELLED: "execution_cancelled",
  ERROR: "error",
} as const;
