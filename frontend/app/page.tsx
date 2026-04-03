"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { ApprovalModal } from "@/components/ApprovalModal";
import { useSession } from "@/contexts/SessionContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import Game from "@/components/Game";
import { api } from "@/lib/api";

export default function Home() {
  const { authenticated, ready, user } = usePrivy();
  const { pendingApproval } = useSession();
  useWebSocket();

  useEffect(() => {
    if (user?.wallet?.address) {
      api.setWalletAddress(user.wallet.address);
    }
  }, [user?.wallet?.address]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <Game userId={user?.id || ""} walletAddress={user?.wallet?.address || ""} />
      {pendingApproval && <ApprovalModal />}
    </main>
  );
}
