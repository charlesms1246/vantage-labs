"use client";

import { usePrivy } from "@privy-io/react-auth";
import { truncateAddress } from "@/utils/formatters";
import { Button } from "@/components/ui/button";

export default function PrivyAuthButton() {
  const { authenticated, ready, login, logout, user } = usePrivy();

  if (!ready) return <div className="w-20 h-9" />;

  if (!authenticated) {
    return (
      <Button
        onClick={login}
        className="px-4 py-2 text-sm font-medium"
      >
        Sign In
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-mono text-foreground">
        {truncateAddress(user?.wallet?.address || "")}
      </span>
      <Button
        onClick={logout}
        variant="ghost"
        size="sm"
        className="text-xs"
      >
        Disconnect
      </Button>
    </div>
  );
}
