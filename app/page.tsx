"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  EXPLORER,
  FAUCET,
  LAUNCHPAD,
  fmtPrice,
  fmtUsd,
  marketCap,
  PRESETS,
} from "./lib/arcpad";
import { useArcPadData, useWallet } from "./lib/useArcPad";
import { useMeta } from "./lib/useMeta";
import { CoinAvatar } from "./components/avatar";
import { ShaderBackground } from "./components/shader-background";
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  Footer,
  Notice,
  Topbar,
} from "./components/chrome";

const VAULTS = [
  {
    name: "Grow",
    tagline: "Fund the community that grows the coin.",
    parts: [
      { label: "creator 37.5%", w: 37.5, c: "var(--blue)" },
      { label: "bounties 37.5%", w: 37.5, c: "var(--blue-bright)" },
      { label: "treasury 25%", w: 25, c: "var(--gold)" },
    ],
  },
  {
    name: "Agent",
    tagline: "Route fees to an autonomous agent wallet.",
    parts: [
      { label: "agent 62.5%", w: 62.5, c: "var(--navy)" },
      { label: "creator 25%", w: 25, c: "var(--blue)" },
      { label: "bounties 12.5%", w: 12.5, c: "var(--blue-bright)" },
    ],
  },
  {
    name: "Burn",
    tagline: "Buy the coin back and burn it, forever.",
    parts: [
      { label: "buyback & burn 62.5%", w: 62.5, c: "var(--red)" },
      { label: "creator 25%", w: 25, c: "var(--blue)" },
      { label: "treasury 12.5%", w: 12.5, c: "var(--gold)" },
    ],
  },
  {
    name: "Creator",
    tagline: "Keep it simple: most fees go to the maker.",
    parts: [
      { label: "creator 76.5%", w: 76.5, c: "var(--blue)" },
      { label: "bounties 11.75%", w: 11.75, c: "var(--blue-bright)" },
      { label: "treasury 11.75%", w: 11.75, c: "var(--gold)" },
    ],
  },
];

const CONTRACTS: Array<[string, string]> = [
  ["ArcPadLaunchpad (verified source)", LAUNCHPAD],
  ["USDC (ERC-20 interface, 6 decimals)", "0x3600000000000000000000000000000000000000"],
  ["UNITFLOW V3 factory (graduation venue)", "0xAb6A8AAb7d490007634ef59d424b5d89688a1971"],
  ["UNITFLOW position manager (locked LP)", "0x77c39eB310BE31e60068CE29855F83359bf85fc4"],
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function LiveLaunchCard({ symbol, name, baseCap, time, target, accent, image }: { symbol: string; name: string; baseCap: number; time: string; target: number; accent: string; image: string }) {
  const [progress, setProgress] = useState(Math.max(1, target - 9));
  const [cap, setCap] = useState(baseCap * .92);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((value) => value >= target ? Math.max(1, target - 9) : Math.min(target, value + .12 + Math.random() * .34));
      setCap((value) => value >= baseCap ? baseCap * .92 : Math.min(baseCap, value + baseCap * (.002 + Math.random() * .005)));
    }, 720);
    return () => window.clearInterval(timer);
  }, [baseCap, target]);
  return (
    <div className="graduated-token" style={{ "--token-accent": accent, "--bonding-progress": `${progress}%` } as React.CSSProperties}>
      <div className="token-art"><Image src={image} alt={`${name} token artwork`} fill sizes="(max-width: 640px) 45vw, 280px" /><i /></div>
      <div className="token-info"><span className="graduated-badge">BONDING LIVE</span><strong>{name}</strong><small>${symbol}</small></div>
      <div className="token-metrics"><span><b>${cap.toFixed(1)}k</b> MC</span><span>{time}</span></div>
      <div className="graduated-progress"><div><i><b /><b /><b /><b /></i></div><span>{progress.toFixed(1)}%</span></div>
      <div className="token-lock"><span>CURVE ACTIVE</span><span>0x8eA7...Be131</span></div>
    </div>
  );
}

export default function Landing() {
  const wallet = useWallet();
  const { coins, loading } = useArcPadData();
  const { metas } = useMeta();

  const totals = {
    coins: coins.length,
    graduated: coins.filter((c) => c.graduated).length,
    raised: coins.reduce((s, c) => s + c.realUsdc, 0n),
  };

  const featured =
    [...coins]
      .filter((c) => !c.graduated)
      .sort((a, b) => (a.progressBps > b.progressBps ? -1 : 1))[0] ?? coins[0];

  return (
    <main className="app">
      <Notice />
      <Topbar wallet={wallet} landing />

      <section className="hero">
        <ShaderBackground />
        <div className="shell hero-inner">
          <span className="hero-badge rise d1">
            <i className="dot" />
            <b>Live on Arc Testnet</b> · Powered by USDC
          </span>
          <span className="hero-eyebrow rise d1">The meme launchpad built natively on Arc</span>
          <h1 className="rise d2">
            Launch culture.<br />
            <span>Program value.</span>
          </h1>
          <p className="lede rise d3">
            Create and trade tokens through transparent USDC bonding curves.
            Route trading fees into programmable vaults, then graduate into
            permanently locked DEX liquidity—all enforced onchain.
          </p>
          <div className="hero-ctas rise d3">
            <Link className="btn btn-gold btn-lg" href="/app">
              Explore launches <span className="arr"><ArrowRightIcon /></span>
            </Link>
            <Link className="btn btn-outline btn-lg" href="/create">Launch a token</Link>
          </div>
          <div className="trust-row rise d4">
            <a
              className="trust-chip"
              href={`${EXPLORER}/address/${LAUNCHPAD}`}
              target="_blank"
              rel="noreferrer"
            >
              <CheckIcon /> Verified smart contract
            </a>
            <span className="trust-chip"><LockIcon /> Liquidity locked at graduation</span>
            <span className="trust-chip">USDC-native · Arc Testnet</span>
          </div>

          <div className="stat-tiles rise d5">
            <div className="stat-tile">
              <strong>{loading ? "…" : totals.coins}</strong>
              <span>Tokens launched</span>
            </div>
            <div className="stat-tile">
              <strong>{loading ? "…" : fmtUsd(totals.raised)}</strong>
              <span>USDC raised</span>
            </div>
            <div className="stat-tile">
              <strong>{loading ? "…" : totals.graduated}</strong>
              <span>Tokens graduated</span>
            </div>
          </div>

          {featured && (
            <div className="feat-card rise d5">
              <span className="feat-kicker">Featured launch</span>
              <div className="feat-id">
                <CoinAvatar symbol={featured.symbol} image={metas[featured.token.toLowerCase()]?.image} />
                <div>
                  <strong>{featured.name}</strong>
                  <span className="mono">
                    ${featured.symbol} · {(PRESETS[featured.preset] ?? PRESETS[0]).name === "Burn" ? "Buyback & Burn" : (PRESETS[featured.preset] ?? PRESETS[0]).name} Vault
                  </span>
                </div>
              </div>
              <div className="feat-data">
                <div>
                  <span>Price</span>
                  <b>{fmtPrice(featured.price)}</b>
                </div>
                <div>
                  <span>Market cap</span>
                  <b>{fmtUsd(marketCap(featured.price) / 10n ** 18n)}</b>
                </div>
                <div>
                  <span>Raised</span>
                  <b>{fmtUsd(featured.realUsdc)}</b>
                </div>
                <div>
                  <span>Bonding curve</span>
                  <b>{(Number(featured.progressBps) / 100).toFixed(1)}%</b>
                </div>
              </div>
              <Link className="btn btn-primary" href="/app">
                View market <span className="arr"><ArrowRightIcon /></span>
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="flow-band section" id="how">
        <div className="shell">
          <span className="section-kicker">How it works</span>
          <div className="section-head">
            <h2>From meme to locked liquidity</h2>
          </div>
          <div className="flow-wrap">
            <div className="flow-grid">
              <div className="flow-step">
                <span className="flow-num">01</span>
                <span className="flow-label">SET THE RULES</span>
                <div className="step-visual visual-create" aria-hidden="true">
                  <span className="token-core">A</span>
                  <i className="orbit orbit-one" />
                  <i className="orbit orbit-two" />
                  <i className="launch-pulse" />
                </div>
                <b>Create</b>
                <p>
                  Choose a name, ticker, fee vault and a 3k–25k USDC target.
                  One transaction launches the token and opens its curve.
                </p>
                <span className="fee">$0.01 + GAS</span>
              </div>
              <div className="flow-step">
                <span className="flow-num">02</span>
                <span className="flow-label">DISCOVER PRICE</span>
                <div className="step-visual visual-trade" aria-hidden="true">
                  <i className="trade-grid" />
                  <i className="trade-line" />
                  <i className="trade-dot" />
                  <span className="trade-usdc">USDC</span>
                </div>
                <b>Trade</b>
                <p>
                  800M tokens trade on a transparent USDC bonding curve. Every
                  quote, price and progress update comes directly on-chain.
                </p>
                <span className="fee">1.5% PER TRADE</span>
              </div>
              <div className="flow-step">
                <span className="flow-num">03</span>
                <span className="flow-label">PROGRAM FEES</span>
                <div className="step-visual visual-route" aria-hidden="true">
                  <i className="route-source" />
                  <i className="route-line route-a" />
                  <i className="route-line route-b" />
                  <i className="route-line route-c" />
                  <i className="route-node node-a" />
                  <i className="route-node node-b" />
                  <i className="route-node node-c" />
                </div>
                <b>Route</b>
                <p>
                  Every trade routes 1% to your chosen vault and 0.5% to the
                  platform. Recipients claim USDC directly from the contract.
                </p>
                <span className="fee">1% TO YOUR VAULT</span>
              </div>
              <div className="flow-step">
                <span className="flow-num">04</span>
                <span className="flow-label">LOCK LIQUIDITY</span>
                <div className="step-visual visual-graduate" aria-hidden="true">
                  <i className="liquidity-ring" />
                  <i className="lock-body" />
                  <i className="lock-loop" />
                  <i className="lock-wave" />
                </div>
                <b>Graduate</b>
                <p>
                  At the target, 200M tokens and the USDC raise become UNITFLOW
                  liquidity. The LP position is then locked permanently.
                </p>
                <span className="fee">LP LOCKED FOREVER</span>
              </div>
            </div>

            <div className="curve-panel">
              <div className="curve-ambient" aria-hidden="true"><i /><i /><i /></div>
              <div className="curve-head">
                <span>BONDING CURVE TO GRADUATION</span>
                <span className="live"><i className="dot" />LIVE</span>
              </div>
              <div className="curve-body">
                <svg viewBox="0 0 560 250" role="img" aria-label="Bonding curve rising to a graduation point where liquidity is locked">
                  <defs>
                    <linearGradient id="curveGrad" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0" stopColor="#0c79d8" />
                      <stop offset="1" stopColor="#8be1ff" />
                    </linearGradient>
                    <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#0c79d81f" />
                      <stop offset="1" stopColor="#0c79d800" />
                    </linearGradient>
                  </defs>
                  {[52, 104, 156].map((y) => (
                    <line key={y} x1="28" y1={y} x2="532" y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 6" />
                  ))}
                  <path
                    d="M28 208 C 190 200, 330 172, 448 76 L 448 208 Z"
                    fill="url(#fillGrad)"
                    className="curve-pop"
                  />
                  <path
                    className="curve-path"
                    d="M28 208 C 190 200, 330 172, 448 76"
                    stroke="url(#curveGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <g className="curve-pop">
                    <line className="graduation-line" x1="448" y1="76" x2="532" y2="76" stroke="#75d5ff" strokeWidth="2" strokeDasharray="3 5" />
                    <circle className="graduation-point" cx="448" cy="76" r="6.5" fill="#75d5ff" stroke="#fff" strokeWidth="2.5" />
                    <text x="448" y="52" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="700" fill="#dff5ff">
                      GRADUATION
                    </text>
                    <text x="448" y="64" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="#91b5ca">
                      LP locked forever
                    </text>
                  </g>
                  <text x="28" y="234" fontFamily="var(--font-mono)" fontSize="9" fill="var(--muted)">
                    SUPPLY SOLD
                  </text>
                  <text x="532" y="234" textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--muted)">
                    PRICE IN USDC
                  </text>
                </svg>
              </div>
              <div className="curve-stats">
                <div>
                  <span>Fixed supply</span>
                  <strong>1B</strong>
                </div>
                <div>
                  <span>Fee per trade</span>
                  <strong>1.5%</strong>
                </div>
                <div>
                  <span>LP at graduation</span>
                  <strong>Locked</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="graduated-section section" id="graduated">
        <div className="shell">
          <div className="pixel-terminal">
            <div className="terminal-topline">
              <div className="terminal-brand"><span className="pixel-mark">◆</span><span>ARCPAD / LIVE CURVES</span></div>
              <span className="terminal-status"><i /> LIVE ON ARC</span>
            </div>
            <div className="graduated-head">
              <div>
                <span className="pixel-kicker">LIVE BONDING CURVES</span>
                <h2>Launching now</h2>
                <p>Live buys move market caps and push every token toward graduation.</p>
              </div>
              <div className="terminal-count"><strong>04</strong><span>ACTIVE</span></div>
            </div>
            <div className="graduated-grid">
              <LiveLaunchCard symbol="SMO" name="Arc Smoke" baseCap={6.4} time="2m ago" target={68} accent="#82d8ff" image="/tokens/arc-smoke.webp" />
              <LiveLaunchCard symbol="WAG" name="wagmi.exe" baseCap={12.8} time="18m ago" target={84} accent="#b9a5ff" image="/tokens/wagmi-exe.webp" />
              <LiveLaunchCard symbol="ARC" name="Arc Signal" baseCap={4.7} time="1h ago" target={47} accent="#79e8bc" image="/tokens/arc-signal.webp" />
              <LiveLaunchCard symbol="PXL" name="Pixel Protocol" baseCap={19.2} time="3h ago" target={92} accent="#ff9fca" image="/tokens/pixel-protocol.webp" />
            </div>
            <div className="terminal-footer"><span>01 — 01</span><span className="terminal-dots">● ○ ○</span><a href="/app">Explore all launches ↗</a></div>
          </div>
        </div>
      </section>

      <section className="section shell vault-section" id="vaults">
        <span className="section-kicker">Programmable fee vaults</span>
        <div className="section-head">
          <h2>1% of every trade, routed your way</h2>
          <span className="count">enforced on-chain, claimable any time</span>
        </div>
        <div className="coin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))" }}>
          {VAULTS.map((v) => (
            <div className="vault-card" key={v.name}>
              <b>{v.name} vault</b>
              <small>{v.tagline}</small>
              <div className="split-bar">
                {v.parts.map((p) => (
                  <i key={p.label} style={{ width: `${p.w}%`, background: p.c }} />
                ))}
              </div>
              <div className="split-legend">
                {v.parts.map((p) => (
                  <span key={p.label}>
                    <i style={{ background: p.c }} />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section shell contract-section" id="contracts" style={{ paddingTop: 0 }}>
        <span className="section-kicker">Everything on-chain</span>
        <div className="section-head">
          <h2>Verify it yourself</h2>
          <span className="count">Arc testnet · chain id 5042002</span>
        </div>
        <div className="aside-card" style={{ maxWidth: 780 }}>
          {CONTRACTS.map(([label, addr]) => (
            <div className="act-row" key={addr}>
              <div className="act-main">
                <b style={{ fontFamily: "var(--font-body)" }}>{label}</b>
                <small className="mono">{addr}</small>
              </div>
              <a
                className="act-link"
                href={`${EXPLORER}/address/${addr}`}
                target="_blank"
                rel="noreferrer"
              >
                Arcscan <ExternalLinkIcon />
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="section shell faq-section" id="faq" style={{ paddingTop: 0 }}>
        <span className="section-kicker">FAQ</span>
        <div className="section-head">
          <h2>Questions, answered</h2>
        </div>
        <div className="faq-grid">
          <div className="faq-item">
            <b>Is this real money?</b>
            <p>
              No. ArcPad runs on Arc testnet. You trade with testnet USDC from{" "}
              <a href={FAUCET} target="_blank" rel="noreferrer">Circle&apos;s faucet</a>,
              and tokens have no monetary value.
            </p>
          </div>
          <div className="faq-item">
            <b>What wallet do I need?</b>
            <p>
              Any injected EVM wallet such as MetaMask. ArcPad adds the Arc
              Testnet network for you on first use; gas is paid in testnet
              USDC.
            </p>
          </div>
          <div className="faq-item">
            <b>Where do the fees go?</b>
            <p>
              Fee routing is enforced on-chain per coin: the creator picks a
              vault preset at launch and the contract splits every fee
              accordingly. Recipients claim their USDC directly from the
              contract at any time.
            </p>
          </div>
          <div className="faq-item">
            <b>Can liquidity be pulled after graduation?</b>
            <p>
              No. The LP NFT is held by the launchpad contract with no
              withdrawal function. Pool fees are harvested through the contract
              and split by the vault preset; the token side is burned.
            </p>
          </div>
          <div className="faq-item">
            <b>What can the platform owner change?</b>
            <p>
              Fee percentages (hard-capped at 5% total in the contract),
              creation and graduation fees, allowed raise tiers, and pausing
              new launches. The owner can never pause sells, touch locked
              liquidity, or withdraw user funds.
            </p>
          </div>
          <div className="faq-item">
            <b>Can I verify any of this?</b>
            <p>
              Yes. The launchpad is verified on{" "}
              <a href={`${EXPLORER}/address/${LAUNCHPAD}`} target="_blank" rel="noreferrer">
                Arcscan
              </a>{" "}
              and every trade, fee split and graduation is a public transaction
              on Arc.
            </p>
          </div>
        </div>
      </section>

      <section className="section shell" style={{ paddingTop: 0 }}>
        <div className="cta-band">
          <div>
            <h2>Ready to launch on Arc?</h2>
            <p>Deploy a coin for a cent, program its fees, let the curve do the rest.</p>
          </div>
          <Link className="btn btn-gold btn-lg" href="/create">
            Create a coin <span className="arr"><ArrowRightIcon /></span>
          </Link>
        </div>
      </section>

      <Footer launchpad={LAUNCHPAD} explorer={EXPLORER} />
    </main>
  );
}
