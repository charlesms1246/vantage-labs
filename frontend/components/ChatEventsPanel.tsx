"use client";

import { useState } from "react";

type Tab = "chat" | "events";

interface ChatEventsPanelProps {
  chatContent: React.ReactNode;
  eventsContent: React.ReactNode;
}

export function ChatEventsPanel({ chatContent, eventsContent }: ChatEventsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div className="h-full flex flex-col rounded-2xl border-[5px] border-foreground bg-card/80 backdrop-blur-sm overflow-hidden">
      {/* Tab Header */}
      <div className="flex items-center px-4 py-3 border-b border-current/20 shrink-0">
        <button
          onClick={() => setActiveTab("chat")}
          className={`font-bold text-[24px] uppercase tracking-wide transition-opacity ${
            activeTab === "chat" ? "opacity-100" : "opacity-40"
          }`}
        >
          Agent Chat
        </button>
        <span className="mx-2 opacity-40">|</span>
        <button
          onClick={() => setActiveTab("events")}
          className={`font-bold text-[24px] uppercase tracking-wide transition-opacity ${
            activeTab === "events" ? "opacity-100" : "opacity-40"
          }`}
        >
          Events
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === "chat" ? "h-full" : "hidden"}>
          {chatContent}
        </div>
        <div className={activeTab === "events" ? "h-full overflow-y-auto" : "hidden"}>
          {eventsContent}
        </div>
      </div>
    </div>
  );
}
