"use client";

import { useState, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";

export function useAgents() {
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "agent_thinking" && lastMessage.agent) {
      setActiveAgent(lastMessage.agent as string);
    } else if (
      lastMessage.type === "execution_complete" ||
      lastMessage.type === "plan_ready"
    ) {
      setActiveAgent(null);
    }
  }, [lastMessage]);

  return { agents: [], activeAgent };
}
