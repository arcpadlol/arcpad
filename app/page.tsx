"use client";

import Link from "next/link";
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
      <Topbar wallet={wallet} />

      <section className="hero">
        <div className="shell hero-inner">
          <span className="hero-badge rise d1">
            <i className="dot" />
            <b>Live on Arc testnet</b> · USDC-native launches
          </span>
          <h1 className="rise d2">
            Launch memes.<br />
            <span>Program the money.</span>
          </h1>
          <p className="lede rise d3">
            Every coin on ArcPad sells on a USDC bonding curve, routes its
            trading fees through a vault you program, and graduates into DEX
            liquidity that nobody can pull. The contract enforces all of it.
          </p>
          <div className="hero-ctas rise d3">
            <Link className="btn btn-gold btn-lg" href="/app">
              Launch app <span className="arr"><ArrowRightIcon /></span>
            </Link>
            <Link className="btn btn-outline btn-lg" href="/create">Create a coin</Link>
          </div>
          <div className="trust-row rise d4">
            <a
              className="trust-chip"
              href={`${EXPLORER}/address/${LAUNCHPAD}`}
              target="_blank"
              rel="noreferrer"
            >
              <CheckIcon /> Contract verified on Arcscan
            </a>
            <span className="trust-chip"><LockIcon /> LP locked at graduation</span>
            <span className="trust-chip">USDC-native · chain id 5042002</span>
          </div>

          <div className="stat-tiles rise d5">
            <div className="stat-tile">
              <strong>{loading ? "…" : totals.coins}</strong>
              <span>Coins launched</span>
            </div>
            <div className="stat-tile">
              <strong>{loading ? "…" : fmtUsd(totals.raised)}</strong>
              <span>USDC on curves</span>
            </div>
            <div className="stat-tile">
              <strong>{loading ? "…" : totals.graduated}</strong>
              <span>Graduated</span>
            </div>
          </div>

          {featured && (
            <div className="feat-card rise d5">
              <div className="feat-id">
                <CoinAvatar symbol={featured.symbol} image={metas[featured.token.toLowerCase()]?.image} />
                <div>
                  <strong>{featured.name}</strong>
                  <span className="mono">
                    ${featured.symbol} · {(PRESETS[featured.preset] ?? PRESETS[0]).name} vault
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
                  <span>Curve</span>
                  <b>{(Number(featured.progressBps) / 100).toFixed(1)}%</b>
                </div>
              </div>
              <Link className="btn btn-primary" href="/app">
                Trade <span className="arr"><ArrowRightIcon /></span>
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
                <b>Create</b>
                <p>
                  Name it, pick a ticker, choose a vault and a graduation target
                  from 3k to 25k USDC. One transaction deploys the token and
                  opens its curve.
                </p>
                <span className="fee">$0.01 + GAS</span>
              </div>
              <div className="flow-step">
                <span className="flow-num">02</span>
                <b>Trade</b>
                <p>
                  800M of the 1B supply sells on a constant-product curve
                  denominated in USDC. Quotes, prices and progress come straight
                  from the contract.
                </p>
                <span className="fee">1.5% PER TRADE</span>
              </div>
              <div className="flow-step">
                <span className="flow-num">03</span>
                <b>Route</b>
                <p>
                  1% of every trade flows to your vault preset, 0.5% to the
                  platform. Recipients claim their USDC from the contract
                  whenever they want.
                </p>
                <span className="fee">1% TO YOUR VAULT</span>
              </div>
              <div className="flow-step">
                <span className="flow-num">04</span>
                <b>Graduate</b>
                <p>
                  At the target, the remaining 200M tokens plus the raise become
                  full-range UNITFLOW liquidity at the same price, and the LP
                  NFT locks in the contract.
                </p>
                <span className="fee">LP LOCKED FOREVER</span>
              </div>
            </div>

            <div className="curve-panel">
              <div className="curve-head">
                <span>BONDING CURVE TO GRADUATION</span>
                <span className="live"><i className="dot" />LIVE</span>
              </div>
              <div className="curve-body">
                <svg viewBox="0 0 560 250" role="img" aria-label="Bonding curve rising to a graduation point where liquidity is locked">
                  <defs>
                    <linearGradient id="curveGrad" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0" stopColor="#0c79d8" />
                      <stop offset="1" stopColor="#edaa3f" />
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
                    <line x1="448" y1="76" x2="532" y2="76" stroke="var(--gold)" strokeWidth="2" strokeDasharray="3 5" />
                    <circle cx="448" cy="76" r="6.5" fill="var(--gold)" stroke="#fff" strokeWidth="2.5" />
                    <text x="448" y="52" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="700" fill="var(--navy)">
                      GRADUATION
                    </text>
                    <text x="448" y="64" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--muted)">
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

      <section className="section shell" id="vaults">
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

      <section className="section shell" id="contracts" style={{ paddingTop: 0 }}>
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

      <section className="section shell" id="faq" style={{ paddingTop: 0 }}>
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
