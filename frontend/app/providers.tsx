"use client";

import dynamic from "next/dynamic";
import { SessionProvider } from "@/contexts/SessionContext";

// PrivyProvider must be client-only (no SSR) — it validates appId on init
const PrivyProviderClientOnly = dynamic(
  () =>
    import("@privy-io/react-auth").then((mod) => {
      const { PrivyProvider } = mod;
      const { flowTestnet } = require("viem/chains");

      function PrivyWrapper({ children }: { children: React.ReactNode }) {
        return (
          <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
            config={{
              loginMethods: ["email", "wallet"],
              appearance: {
                theme: "dark",
                accentColor: "#3B82F6",
              },
              embeddedWallets: {
                ethereum: { createOnLogin: "users-without-wallets" },
              },
              // Force Coinbase Wallet to EOA-only mode — Coinbase Smart Wallet
              // does not support Flow EVM Testnet (chainId 545) and throws on init.
              externalWallets: {
                coinbaseWallet: {
                  config: { preference: { options: "eoaOnly" } },
                },
              },
              defaultChain: flowTestnet,
              supportedChains: [flowTestnet],
            }}
          >
            {children}
          </PrivyProvider>
        );
      }
      return PrivyWrapper;
    }),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProviderClientOnly>
      <SessionProvider>
        {children}
      </SessionProvider>
    </PrivyProviderClientOnly>
  );
}
