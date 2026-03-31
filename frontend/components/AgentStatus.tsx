"use client";

import { useAgents } from "@/hooks/useAgents";
import { useWebSocket } from "@/hooks/useWebSocket";

const AGENT_INFO = {
  Eric: { role: "Market Analyst", color: "green", model: "Gemini" },
  Harper: { role: "Trader", color: "red", model: "Groq" },
  Rishi: { role: "Developer", color: "blue", model: "OpenRouter" },
  Yasmin: { role: "Creative", color: "pink", model: "Gemini" },
} as const;

const COLOR_CLASSES = {
  green: {
    active: "border-green-500 bg-green-950",
    avatar: "bg-green-800",
    dot: "bg-green-500",
  },
  red: {
    active: "border-red-500 bg-red-950",
    avatar: "bg-red-800",
    dot: "bg-red-500",
  },
  blue: {
    active: "border-blue-500 bg-blue-950",
    avatar: "bg-blue-800",
    dot: "bg-blue-500",
  },
  pink: {
    active: "border-pink-500 bg-pink-950",
    avatar: "bg-pink-800",
    dot: "bg-pink-500",
  },
};

export function AgentStatus() {
  const { activeAgent } = useAgents();
  const { connected } = useWebSocket();

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Agent Swarm
      </h2>

      <div className="space-y-2">
        {Object.entries(AGENT_INFO).map(([name, info]) => {
          const colors = COLOR_CLASSES[info.color];
          const isActive = activeAgent === name;

          return (
            <div
              key={name}
              className={`p-3 rounded-lg border transition-all ${
                isActive ? colors.active : "border-gray-800 bg-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full ${colors.avatar} flex items-center justify-center text-sm font-semibold`}
                >
                  {name[0]}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{name}</div>
                  <div className="text-xs text-gray-500">{info.role}</div>
                </div>
              </div>

              {isActive && (
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`}
                  />
                  <span className="text-xs text-gray-400">Thinking...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-gray-800">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Networks
        </h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Flow EVM</span>
            <span
              className={`flex items-center gap-1 ${connected ? "text-green-400" : "text-gray-600"}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {connected ? "Live" : "Off"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Filecoin</span>
            <span
              className={`flex items-center gap-1 ${connected ? "text-green-400" : "text-gray-600"}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {connected ? "Live" : "Off"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
