"use client";

import { useState } from "react";
import NotificationBoard from "./NotificationBoard";

// ── Colour maps ──────────────────────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, string> = {
  LLM:     "bg-violet-900/60 text-violet-300 border border-violet-500/40",
  TOOL:    "bg-amber-900/60  text-amber-300  border border-amber-500/40",
  IPFS:    "bg-cyan-900/60   text-cyan-300   border border-cyan-500/40",
  ONCHAIN: "bg-emerald-900/60 text-emerald-300 border border-emerald-500/40",
  WS:      "bg-blue-900/60   text-blue-300   border border-blue-500/40",
  SYSTEM:  "bg-zinc-800/60   text-zinc-300   border border-zinc-500/40",
  LIGHTHOUSE: "bg-cyan-900/60 text-cyan-300  border border-cyan-500/40",
};

const LEVEL_TEXT: Record<string, string> = {
  INFO:  "text-foreground/80",
  WARN:  "text-amber-400",
  ERROR: "text-red-400",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface SystemEvent {
  id: string;
  category: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  data?: unknown;
  timestamp: Date;
}

interface SystemEventsPanelProps {
  systemEvents: SystemEvent[];
  notifications: any[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function badgeClass(category: string): string {
  return (
    CATEGORY_BADGE[category.toUpperCase()] ??
    "bg-zinc-800/60 text-zinc-300 border border-zinc-500/40"
  );
}

function levelClass(level: string): string {
  return LEVEL_TEXT[level] ?? "text-foreground/80";
}

function formatData(data: unknown): string | null {
  if (data === undefined || data === null) return null;
  if (typeof data === "string") return data.length > 300 ? data.slice(0, 300) + "…" : data;
  try {
    const s = JSON.stringify(data, null, 2);
    return s.length > 500 ? s.slice(0, 500) + "\n…" : s;
  } catch {
    return String(data);
  }
}

// ── Components ───────────────────────────────────────────────────────────────

function SystemLogEntry({ event }: { event: SystemEvent }) {
  const [expanded, setExpanded] = useState(false);
  const dataStr = formatData(event.data);

  return (
    <div
      className="px-3 py-2 border-b border-foreground/10 hover:bg-foreground/5 cursor-pointer"
      onClick={() => dataStr && setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-2 flex-wrap">
        {/* Time */}
        <span className="text-[10px] text-foreground/40 shrink-0 mt-0.5 font-mono">
          {event.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>

        {/* Category badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold shrink-0 ${badgeClass(event.category)}`}>
          {event.category}
        </span>

        {/* Level indicator for WARN/ERROR */}
        {event.level !== "INFO" && (
          <span className={`text-[10px] font-bold shrink-0 ${levelClass(event.level)}`}>
            {event.level}
          </span>
        )}

        {/* Message */}
        <span className={`text-xs break-words flex-1 ${levelClass(event.level)}`}>
          {event.message}
        </span>

        {/* Expand toggle if there's data */}
        {dataStr && (
          <span className="text-[10px] text-foreground/30 shrink-0">
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </div>

      {/* Expanded data */}
      {expanded && dataStr && (
        <pre className="mt-1 ml-2 text-[10px] text-foreground/60 bg-background/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words font-mono">
          {dataStr}
        </pre>
      )}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

type Tab = "notifications" | "logs";

export function SystemEventsPanel({ systemEvents, notifications }: SystemEventsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("notifications");

  const tabBtn = (label: string, tab: Tab, count?: number) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded transition-colors ${
        activeTab === tab
          ? "bg-foreground text-background"
          : "text-foreground/50 hover:text-foreground/80"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
      )}
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-foreground/20 shrink-0">
        {tabBtn("Notifications", "notifications", notifications.length)}
        {tabBtn("System Logs", "logs", systemEvents.length)}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Notifications tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "notifications" ? "" : "hidden"}`}>
          <NotificationBoard notifications={notifications} />
        </div>

        {/* System Logs tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "logs" ? "" : "hidden"}`}>
          {systemEvents.filter(ev => ev.category !== "WS" && ev.category !== "LLM").length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-foreground/30">
              No matching log events yet — run an agent task to see live backend logs.
            </div>
          ) : (
            <div className="divide-y divide-foreground/5">
              {systemEvents
                .filter(ev => ev.category !== "WS" && ev.category !== "LLM")
                .map((ev) => (
                  <SystemLogEntry key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
