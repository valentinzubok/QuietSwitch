import type { Metadata } from "next";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuietSwitch",
  description:
    "A dead-man's switch on GenLayer Studio Dev (chain 61997) that only fires when validators agree a committed liveness page has stopped showing proof of life.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
