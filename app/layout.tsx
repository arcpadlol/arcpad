import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const dmSans = localFont({
  src: "../public/fonts/dm-sans.woff2",
  variable: "--font-dm-sans",
  display: "swap",
});

const grotesk = localFont({
  src: "../public/fonts/space-grotesk.woff2",
  variable: "--font-grotesk",
  display: "swap",
});

const spaceMono = localFont({
  src: [
    { path: "../public/fonts/space-mono.woff2", weight: "400" },
    { path: "../public/fonts/space-mono-bold.woff2", weight: "700" },
  ],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.citizenpad.lol"),
  title: "Citizen — The USDC-native meme launchpad on Arc",
  description:
    "Launch and trade meme tokens on Arc testnet. USDC bonding curves, programmable fee vaults, transparent graduation to locked DEX liquidity.",
  openGraph: {
    title: "Citizen — The USDC-native meme launchpad on Arc",
    description:
      "Launch and trade meme tokens on Arc testnet. USDC bonding curves, programmable fee vaults, transparent graduation to locked DEX liquidity.",
    images: [{ url: "/og.png", width: 1735, height: 907 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Citizen — The USDC-native meme launchpad on Arc",
    description:
      "Launch and trade meme tokens on Arc testnet. USDC bonding curves, programmable fee vaults, transparent graduation to locked DEX liquidity.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${grotesk.variable} ${spaceMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
