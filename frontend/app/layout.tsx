import type { Metadata } from "next";
import { pixelify_sans } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: "Vantage Labs - Decentralized Autonomous Agency",
  description: "AI Agent Swarm for Web3",
  icons: {
    icon: [
      { url: "/vantage_fav/favicon.ico" },
      { url: "/vantage_fav/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/vantage_fav/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="overflow-hidden">
      <body className={`${pixelify_sans.className} overflow-hidden`}>
        <Providers>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
