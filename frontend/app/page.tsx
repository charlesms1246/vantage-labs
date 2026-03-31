"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Header } from "@/components/Header";
import { Terminal } from "@/components/Terminal";
import { AgentStatus } from "@/components/AgentStatus";
import { ApprovalModal } from "@/components/ApprovalModal";
import { useSession } from "@/contexts/SessionContext";

export default function Home() {
  const { authenticated, login, ready } = usePrivy();
  const { pendingApproval } = useSession();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-6 px-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            Vantage Labs
          </h1>
          <p className="text-gray-400 text-lg">
            Decentralized Autonomous Agency
          </p>
          <p className="text-gray-600 text-sm max-w-sm mx-auto">
            An AI agent swarm for Web3 — market analysis, trading, development,
            and creative tasks on Flow EVM & Filecoin.
          </p>
          <button
            onClick={login}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />

      <main className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-gray-800 p-4 overflow-y-auto">
          <AgentStatus />
        </aside>

        {/* Terminal */}
        <div className="flex-1 overflow-hidden">
          <Terminal />
        </div>
      </main>

      {pendingApproval && <ApprovalModal />}
    </div>
  );
}
