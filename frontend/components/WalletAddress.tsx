"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

export function WalletAddress() {
  const { user, logout } = usePrivy();
  const address = user?.wallet?.address;
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  if (!address) return <div className="w-32" />;

  const truncated = `${address.slice(0, 10)}....`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDisconnect = async () => {
    setIsOpen(false);
    await logout();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={address}
        className="px-4 py-2 rounded-lg border border-foreground/20 bg-foreground/5
                   text-sm hover:bg-foreground/10 transition-colors"
      >
        {copied ? "Copied!" : truncated}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-background border border-foreground rounded-lg shadow-lg z-50 min-w-max">
          <button
            onClick={handleCopy}
            className="block w-full text-left px-4 py-2 hover:bg-foreground/10 transition-colors first:rounded-t-lg text-foreground"
          >
            Copy Address
          </button>
          <div className="border-t border-foreground/20" />
          <button
            onClick={handleDisconnect}
            className="block w-full text-left px-4 py-2 hover:bg-foreground/10 transition-colors last:rounded-b-lg text-foreground"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
