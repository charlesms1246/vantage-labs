"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socketManager } from "@/lib/socket";
import { usePrivy } from "@privy-io/react-auth";
import { useSession } from "@/contexts/SessionContext";
import type { WebSocketMessage } from "@/types";

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const { user } = usePrivy();
  const { setPendingApproval } = useSession();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;

    const walletAddress = user.wallet?.address || "";

    socketManager
      .connect(walletAddress)
      .then(() => setConnected(true))
      .catch((error) => console.error("Failed to connect socket:", error));

    const handleAgentThinking = (data: unknown) => {
      setLastMessage({ type: "agent_thinking", ...(data as object) });
    };

    const handleAgentResponse = (data: unknown) => {
      setLastMessage({ type: "agent_response", ...(data as object) });
    };

    const handlePlanReady = (data: unknown) => {
      const d = data as { sessionId?: string; plan?: WebSocketMessage["plan"] };
      setLastMessage({ type: "plan_ready", ...(data as object) });
      if (d.sessionId && d.plan) {
        setPendingApproval({
          sessionId: d.sessionId,
          plan: d.plan,
        });
      }
    };

    const handleExecutionStarted = (data: unknown) => {
      setLastMessage({ type: "execution_started", ...(data as object) });
    };

    const handleExecutionComplete = (data: unknown) => {
      setLastMessage({ type: "execution_complete", ...(data as object) });
    };

    const handleExecutionCancelled = (data: unknown) => {
      setLastMessage({ type: "execution_cancelled", ...(data as object) });
    };

    const handleError = (data: unknown) => {
      setLastMessage({ type: "error", ...(data as object) });
    };

    socketManager.on("agent_thinking", handleAgentThinking);
    socketManager.on("agent_response", handleAgentResponse);
    socketManager.on("plan_ready", handlePlanReady);
    socketManager.on("execution_started", handleExecutionStarted);
    socketManager.on("execution_complete", handleExecutionComplete);
    socketManager.on("execution_cancelled", handleExecutionCancelled);
    socketManager.on("error", handleError);

    return () => {
      socketManager.off("agent_thinking", handleAgentThinking);
      socketManager.off("agent_response", handleAgentResponse);
      socketManager.off("plan_ready", handlePlanReady);
      socketManager.off("execution_started", handleExecutionStarted);
      socketManager.off("execution_complete", handleExecutionComplete);
      socketManager.off("execution_cancelled", handleExecutionCancelled);
      socketManager.off("error", handleError);
      // Keep socket alive across remounts
    };
  }, [user, setPendingApproval]);

  const sendMessage = useCallback((data: WebSocketMessage) => {
    socketManager.send(data.type, data);
  }, []);

  return { connected, lastMessage, sendMessage };
}
