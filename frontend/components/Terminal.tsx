"use client";

import { useState, useRef, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSession } from "@/contexts/SessionContext";
import { Send, Loader2 } from "lucide-react";
import type { Message, WebSocketMessage } from "@/types";
import { v4 as uuidv4 } from "uuid";

const AGENT_COLORS: Record<string, string> = {
  Orchestrator: "bg-purple-900 border-l-4 border-purple-500",
  Eric: "bg-green-900 border-l-4 border-green-500",
  Harper: "bg-red-900 border-l-4 border-red-500",
  Rishi: "bg-blue-900 border-l-4 border-blue-500",
  Yasmin: "bg-pink-900 border-l-4 border-pink-500",
};

export function Terminal() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      type: "system",
      content: "Vantage Labs DAA initialized. Connect your wallet to begin.",
      timestamp: new Date(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage, lastMessage } = useWebSocket();
  const { sessionId } = useSession();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (lastMessage) {
      handleIncomingMessage(lastMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  const handleIncomingMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case "agent_thinking":
        addMessage({
          type: "system",
          content: `${data.agent} is thinking...`,
        });
        break;

      case "agent_response": {
        const agentContent = (data.result as string) || data.content || "";
        if (agentContent) {
          addMessage({
            type: "agent",
            agent: data.agent,
            content: agentContent,
          });
        }
        break;
      }

      case "plan_ready":
        setIsProcessing(false);
        // pendingApproval is set centrally in useWebSocket
        break;

      case "execution_cancelled":
        setIsProcessing(false);
        addMessage({ type: "system", content: "Execution cancelled." });
        break;

      case "execution_complete": {
        setIsProcessing(false);
        const parts: string[] = ["✅ Execution complete."];
        if (data.logCid) {
          parts.push(`📦 IPFS: https://gateway.lighthouse.storage/ipfs/${data.logCid}`);
        }
        if (data.onChainTxHash) {
          const tokenLabel = data.proofTokenId ? ` (NFT #${data.proofTokenId})` : "";
          parts.push(`⛓️  Flow EVM${tokenLabel}: ${data.onChainExplorerUrl}`);
        }
        addMessage({ type: "system", content: parts.join("\n") });
        break;
      }

      case "error":
        setIsProcessing(false);
        addMessage({
          type: "system",
          content: `Error: ${data.content || "Unknown error"}`,
        });
        break;
    }
  };

  const addMessage = (
    msg: Omit<Message, "id" | "timestamp">,
  ) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: uuidv4(), timestamp: new Date() },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || !sessionId) return;

    addMessage({ type: "user", content: input });

    sendMessage({
      type: "user_message",
      message: input,
      sessionId,
    });

    setInput("");
    setIsProcessing(true);
  };

  const getMessageClass = (type: string, agent?: string) => {
    const base = "px-4 py-2 rounded-lg max-w-[80%]";
    if (type === "user") return `${base} bg-blue-600 ml-auto`;
    if (type === "system") return `${base} bg-gray-800 text-gray-400 text-xs`;
    return `${base} ${AGENT_COLORS[agent || ""] || "bg-gray-800"}`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
        {messages.map((msg) => (
          <div key={msg.id} className={getMessageClass(msg.type, msg.agent)}>
            {msg.type === "agent" && msg.agent && (
              <div className="text-xs text-gray-400 mb-1 font-semibold">
                {msg.agent}
              </div>
            )}
            <div className="whitespace-pre-wrap leading-relaxed">
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-800 p-4 bg-gray-950"
      >
        <div className="flex items-center gap-3">
          <span className="text-green-500 font-mono select-none">❯</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isProcessing
                ? "Processing..."
                : "Enter your command..."
            }
            disabled={isProcessing}
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm placeholder-gray-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-30"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <Send className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
