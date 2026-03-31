import type { Metadata } from "next";
import { inter, pixelify_sans } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";
import Image from "next/image";
import PrivyAuthButton from "@/components/PrivyAuthButton";

export const metadata: Metadata = {
  title: "Vantage Labs - Decentralized Autonomous Agency",
  description: "AI Agent Swarm for Web3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="overflow-hidden">
      <body className={`${inter.className} overflow-hidden`}>
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 h-full w-full bg-[#EAEBED] bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
        </div>
        <Providers>
          <div className="mx-auto max-w-[1280px] h-screen overflow-hidden">
            <div className="flex justify-between items-center p-4 relative">
              <PrivyAuthButton />
              <div className="absolute left-1/2 top-4 -translate-x-1/2">
                <Image
                  src="/logo_industry.png"
                  alt="Vantage Labs Logo"
                  width={180}
                  height={40}
                  priority
                />
              </div>
            </div>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
