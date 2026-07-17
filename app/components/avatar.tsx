"use client";

import type { CSSProperties } from "react";

const AVATAR_BG = [
  "linear-gradient(135deg,#0d1b30,#0c79d8)",
  "linear-gradient(135deg,#0a5fa8,#2e9eff)",
  "linear-gradient(135deg,#b97b17,#edaa3f)",
  "linear-gradient(135deg,#0f3a63,#68c4ff)",
];

export function avatarStyle(symbol: string) {
  const i = (symbol.charCodeAt(0) + (symbol.charCodeAt(1) || 0)) % AVATAR_BG.length;
  return { background: AVATAR_BG[i] };
}

/** Coin avatar: creator-submitted logo when available, letter tile otherwise. */
export function CoinAvatar({
  symbol,
  image,
  className = "coin-avatar",
  style,
}: {
  symbol: string;
  image?: string;
  className?: string;
  style?: CSSProperties;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- proxied blob, unknown dimensions
      <img
        className={className}
        src={image}
        alt={symbol}
        style={{ objectFit: "cover", ...style }}
      />
    );
  }
  return (
    <span className={className} style={{ ...avatarStyle(symbol), ...style }}>
      {symbol.slice(0, 3)}
    </span>
  );
}
