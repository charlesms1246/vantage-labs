"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { SessionProvider } from "@/contexts/SessionContext";
import { flowTestnet } from "viem/chains";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "clxxxxxxxxxxx"}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#3B82F6",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: flowTestnet,
        supportedChains: [flowTestnet],
      }}
    >
      <SessionProvider>{children}</SessionProvider>
    </PrivyProvider>
  );
}
