"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_URL, EXPLORER, FAUCET, GITHUB_URL, X_URL, short } from "../lib/arcpad";
import { useWallet } from "../lib/useArcPad";

export function ArcMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22 19.2727C22 20.779 20.779 22 19.2727 22H14.7273C13.221 22 12 20.779 12 19.2727V12H19.2727C20.779 12 22 13.221 22 14.7273V19.2727Z" fill="#68C4FF" />
      <path d="M20 2C21.1046 2 22 2.89543 22 4V7C22 8.10457 21.1046 9 20 9H17C15.8954 9 15 8.10457 15 7V4C15 2.89543 15.8954 2 17 2H20Z" fill="#0C79D8" />
      <path d="M7 15C8.10457 15 9 15.8954 9 17V20C9 21.1046 8.10457 22 7 22H4C2.89543 22 2 21.1046 2 20V17C2 15.8954 2.89543 15 4 15H7Z" fill="#0C79D8" />
      <path d="M12 12H4.72727C3.22104 12 2 10.779 2 9.27273V4.72727C2 3.22104 3.22104 2 4.72727 2H9.27273C10.779 2 12 3.22104 12 4.72727V12Z" fill="#2E9EFF" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0.297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385 0.6 0.113 0.82-0.258 0.82-0.577 0-0.285-0.01-1.04-0.015-2.04-3.338 0.724-4.042-1.61-4.042-1.61-0.546-1.385-1.333-1.754-1.333-1.754-1.089-0.745 0.084-0.729 0.084-0.729 1.205 0.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495 0.998 0.108-0.776 0.417-1.305 0.76-1.605-2.665-0.3-5.466-1.332-5.466-5.93 0-1.31 0.465-2.38 1.235-3.22-0.135-0.303-0.54-1.523 0.105-3.176 0 0 1.005-0.322 3.3 1.23 0.96-0.267 1.98-0.399 3-0.405 1.02 0.006 2.04 0.138 3 0.405 2.28-1.552 3.285-1.23 3.285-1.23 0.645 1.653 0.24 2.873 0.12 3.176 0.765 0.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92 0.42 0.36 0.81 1.096 0.81 2.22 0 1.605-0.015 2.896-0.015 3.286 0 0.315 0.21 0.69 0.825 0.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 14, height: 14 }}>
      <path d="M2.5 8h11M9.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 12, height: 12 }}>
      <path d="M6.5 3.5h-3A1.5 1.5 0 0 0 2 5v7.5A1.5 1.5 0 0 0 3.5 14H11a1.5 1.5 0 0 0 1.5-1.5v-3M9.5 2H14v4.5M14 2 7.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrendUpIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 13, height: 13 }}>
      <path d="M1.5 11.5 6 7l3 3 5.5-5.5M10 4.5h4.5V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 15, height: 15 }}>
      <rect x="1.5" y="3.5" width="13" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 8.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SocialLinks({ className = "icon-link" }: { className?: string }) {
  return (
    <>
      {X_URL && (
        <a className={className} href={X_URL} target="_blank" rel="noreferrer" aria-label="Citizen on X">
          <XIcon />
        </a>
      )}
      {GITHUB_URL && (
        <a className={className} href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="Citizen on GitHub">
          <GitHubIcon />
        </a>
      )}
    </>
  );
}

export function Notice() {
  return (
    <div className="notice">
      <b>ARC TESTNET</b> · every launch and trade is a real on-chain transaction
      with testnet USDC ·{" "}
      <a href={FAUCET} target="_blank" rel="noreferrer">get testnet USDC</a>
    </div>
  );
}

function ChainPill() {
  return (
    <span className="chain-pill">
      <span className="ping-wrap">
        <i className="ping" />
        <i className="dot" />
      </span>
      Arc Testnet
    </span>
  );
}

const NAV = [
  { label: "Board", href: "/app" },
  { label: "Create", href: "/create" },
  { label: "Activity", href: "/activity" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Docs", href: "/docs" },
];

function ConnectControl({ wallet, landing = false }: { wallet: ReturnType<typeof useWallet>; landing?: boolean }) {
  const [menu, setMenu] = useState(false);

  if (landing) {
    return <a className="btn btn-primary open-app-btn" href={APP_URL}>Open App <ArrowRightIcon /></a>;
  }
  if (!wallet.connected) {
    return (
      <button className="btn btn-primary" onClick={wallet.connect}>
        <WalletIcon /> Connect
      </button>
    );
  }
  if (!wallet.onArc) {
    return (
      <button className="btn btn-gold" onClick={wallet.ensureChain}>
        Switch to Arc
      </button>
    );
  }
  return (
    <div className="wallet-menu-wrap">
      <button
        className="wallet-chip"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((v) => !v)}
      >
        <i className="dot" />
        {short(wallet.account!)}
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 12, height: 12, opacity: 0.7 }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menu && (
        <>
          <button className="wallet-menu-backdrop" aria-label="Close menu" onClick={() => setMenu(false)} />
          <div className="wallet-menu" role="menu">
            <button
              role="menuitem"
              onClick={() => {
                navigator.clipboard?.writeText(wallet.account!);
                setMenu(false);
              }}
            >
              Copy address
            </button>
            <a
              role="menuitem"
              href={`${EXPLORER}/address/${wallet.account}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenu(false)}
            >
              View on Arcscan
            </a>
            <button
              role="menuitem"
              className="wallet-disconnect"
              onClick={() => {
                wallet.disconnect();
                setMenu(false);
              }}
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Topbar({ wallet, landing = false }: { wallet: ReturnType<typeof useWallet>; landing?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // On the marketing landing (root domain) the nav points across to the
  // product on the app subdomain; inside the app it stays client-side routing.
  const links = (extraClass = "") =>
    NAV.map((item) => {
      const active = pathname === item.href || pathname.startsWith(item.href + "/");
      const cls = `${active ? "active" : ""} ${extraClass}`.trim();
      if (landing) {
        // The app subdomain already serves the board at its root, so link
        // there directly instead of the redundant /app path.
        const href = item.href === "/app" ? APP_URL : `${APP_URL}${item.href}`;
        return (
          <a key={item.href} className={cls} href={href} onClick={() => setOpen(false)}>
            {item.label}
          </a>
        );
      }
      return (
        <Link key={item.href} className={cls} href={item.href} onClick={() => setOpen(false)}>
          {item.label}
        </Link>
      );
    });

  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        <Link className="logo" href="/">
          <ArcMark />
          <span className="logo-name">Citi<b>zen</b></span>
          <span className="badge-testnet">TESTNET</span>
        </Link>
        <nav className="topnav">{links()}</nav>
        <div className="top-actions">
          <SocialLinks />
          <ChainPill />
          <ConnectControl wallet={wallet} landing={landing} />
          {!landing && <button
            className="menu-btn"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
              {open ? (
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>}
        </div>
        <nav className={`mobile-nav ${open ? "open" : ""}`}>
          <Link href="/" onClick={() => setOpen(false)}>Home</Link>
          {links()}
          <div className="mobile-foot">
            <ChainPill />
            <span className="mobile-social">
              <SocialLinks />
            </span>
          </div>
        </nav>
      </div>
    </header>
  );
}

export function Footer({
  launchpad,
  explorer,
  landing = false,
}: {
  launchpad: string;
  explorer: string;
  landing?: boolean;
}) {
  // Mirror the topbar: from the landing every product link crosses over to the
  // app subdomain, so the root domain only ever serves the marketing page.
  const to = (href: string) => (href === "/app" ? APP_URL : `${APP_URL}${href}`);
  const productLink = (href: string, label: string) =>
    landing ? (
      <a key={href} href={to(href)}>{label}</a>
    ) : (
      <Link key={href} href={href}>{label}</Link>
    );
  return (
    <footer>
      <div className="shell foot-inner">
        <Link className="logo" href="/">
          <ArcMark />
          <span className="logo-name">Citi<b>zen</b></span>
        </Link>
        <div className="foot-links">
          {productLink("/app", "Board")}
          {productLink("/create", "Create")}
          {productLink("/activity", "Activity")}
          {productLink("/portfolio", "Portfolio")}
          {productLink("/docs", "Docs")}
          <a href={`${explorer}/address/${launchpad}`} target="_blank" rel="noreferrer">Contract</a>
          <a href={FAUCET} target="_blank" rel="noreferrer">Faucet</a>
          <a href="https://docs.arc.network" target="_blank" rel="noreferrer">Arc docs</a>
          <span className="foot-social">
            <SocialLinks />
          </span>
        </div>
      </div>
      <div className="shell foot-note">
        Built on Arc testnet · not affiliated with Circle · tokens are
        speculative test assets and have no value · contracts unaudited, demo
        infrastructure only
      </div>
    </footer>
  );
}
