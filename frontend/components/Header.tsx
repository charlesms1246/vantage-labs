"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWebSocket } from "@/hooks/useWebSocket";

export function Header() {
  const { user, logout } = usePrivy();
  const { connected } = useWebSocket();

  const address = user?.wallet?.address;
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          Vantage Labs
        </span>
        <span className="text-xs text-gray-500 font-mono">DAA</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
          />
          <span className="text-gray-400">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {shortAddress && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-gray-400">
              {shortAddress}
            </span>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
