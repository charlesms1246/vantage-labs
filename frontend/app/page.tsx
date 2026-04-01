"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { ApprovalModal } from "@/components/ApprovalModal";
import { useSession } from "@/contexts/SessionContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import Game from "@/components/Game";
import { api } from "@/lib/api";
import { pixelify_sans } from "./fonts";

export default function Home() {
  const { authenticated, ready, user } = usePrivy();
  const { pendingApproval } = useSession();
  useWebSocket();

  // Sync wallet address to REST API client whenever it changes
  useEffect(() => {
    if (user?.wallet?.address) {
      api.setWalletAddress(user.wallet.address);
    }
  }, [user?.wallet?.address]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-center space-y-6 px-4">
          <h1 className={`text-5xl font-bold text-blue-900 ${pixelify_sans.className}`}>
            Vantage Labs
          </h1>
          <p className="text-gray-600 text-lg">
            Decentralized Autonomous Agency
          </p>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            An AI agent swarm for Web3 — market analysis, trading, development,
            and creative tasks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Game userId={user?.id || ""} walletAddress={user?.wallet?.address || ""} />
      {pendingApproval && <ApprovalModal />}
    </>
  );
}
