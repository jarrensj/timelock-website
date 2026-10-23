import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConnectWallet } from "./connect-wallet";
import "./globals.css";
import { Nav } from "./nav";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "timelock contract",
  description: "timelock contract",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-6">
              <span className="font-semibold">timelock</span>
              <Nav />
            </div>
            <ConnectWallet />
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
