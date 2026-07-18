"use client";

import Link from "next/link";
import { EXPLORER, FAUCET, GITHUB_URL, LAUNCHPAD } from "../lib/arcpad";
import { useWallet } from "../lib/useArcPad";
import { ArrowRightIcon, Footer, Notice, Topbar } from "../components/chrome";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden style={{ width: 18, height: 18 }}>
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SECTIONS = [
  {
    icon: "M10 2.5l2 4.3 4.5.6-3.3 3.2.8 4.6L10 13l-4 2.2.8-4.6-3.3-3.2 4.5-.6z",
    title: "Fair launch, one transaction",
    body: "Anyone can create a coin: pick a name, ticker, fee vault and graduation target, sign once. The full 1B supply is minted at creation with no presale and no team allocation; 800M goes to the curve, 200M is reserved for graduation liquidity. The token cannot be minted again.",
  },
  {
    icon: "M3 15.5C6 15 9 13 11 10.5S15 4.5 17 3.5M12.5 3.5H17V8",
    title: "A USDC bonding curve",
    body: "Trading happens against a constant-product curve denominated in testnet USDC (6 decimals). Price starts low and rises with every buy; quotes, prices and progress are read straight from the contract, not from an off-chain database.",
  },
  {
    icon: "M4 4h12v5H4zM4 12.5h5.5M4 16h9M13 12.5h3",
    title: "Programmable fee vaults",
    body: "Every trade pays a 1.5% fee: 1% flows to the vault preset the creator chose (Grow, Agent, Burn or Creator) and 0.5% to the platform. Splits are enforced by the contract and recipients claim their USDC themselves; nothing is paid out by a server.",
  },
  {
    icon: "M5.5 8.5V6a4.5 4.5 0 0 1 9 0v2.5M4 8.5h12V17H4zM10 12v2.5",
    title: "Graduation locks the liquidity",
    body: "When the curve raises its target, the remaining 200M tokens plus the raised USDC become a full-range UNITFLOW V3 position at the same price, and the LP NFT is held by the launchpad contract with no withdrawal function. Nobody, including the platform owner, can pull that liquidity.",
  },
  {
    icon: "M10 3v14M3 10h14M5.5 5.5l9 9M14.5 5.5l-9 9",
    title: "Metadata lives on Irys",
    body: "Logos, descriptions and links are stored permanently on Irys (Arweave), uploaded and signed by the coin creator's own wallet; uploads under 100 KB are free. The site only shows metadata whose upload signature matches the coin's on-chain creator, so nobody can dress up someone else's coin.",
  },
  {
    icon: "M10 2.5l6.5 3v5c0 3.5-2.6 6.3-6.5 7-3.9-.7-6.5-3.5-6.5-7v-5z",
    title: "What the owner can and cannot do",
    body: "The owner can tune fees (hard-capped at 5% total in the contract), change creation and graduation fees, adjust raise tiers and pause new launches. The owner can never pause sells, withdraw user funds or touch locked liquidity; those paths do not exist in the code.",
  },
];

export default function DocsPage() {
  const wallet = useWallet();

  return (
    <main className="app">
      <Notice />
      <Topbar wallet={wallet} />

      <section className="section shell token-board-section board-terminal-section">
        <div className="pixel-terminal board-terminal">
          <div className="terminal-topline">
            <div className="terminal-brand"><span className="pixel-mark">◆</span><span>CITIZEN / DOCS</span></div>
            <span className="terminal-status"><i /> ENFORCED ON-CHAIN</span>
          </div>
          <div className="graduated-head">
            <div>
              <span className="pixel-kicker">DOCUMENTATION</span>
              <h2>How Citizen works</h2>
              <p>Everything below is enforced by the verified contract on Arc testnet — not by a server.</p>
            </div>
            <div className="board-stats docs-head-stats">
              <div className="board-stat"><strong>1B</strong><span>Fixed supply</span></div>
              <div className="board-stat"><strong>1.5%</strong><span>Trade fee</span></div>
              <div className="board-stat"><strong>Locked</strong><span>At graduation</span></div>
            </div>
          </div>

          <div className="docs-list">
            {SECTIONS.map((s, i) => (
              <article className="docs-card" key={s.title}>
                <div className="docs-card-head">
                  <span className="docs-card-icon"><Icon d={s.icon} /></span>
                  <span className="docs-card-num">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <b>{s.title}</b>
                <p>{s.body}</p>
              </article>
            ))}
          </div>

          <div className="terminal-footer">
            <span>DOCS — 01</span>
            <span className="terminal-dots">● ○ ○</span>
            <a href={`${EXPLORER}/address/${LAUNCHPAD}`} target="_blank" rel="noreferrer">Verified contract ↗</a>
          </div>
        </div>
      </section>

      <section className="section shell token-board-section board-terminal-section" id="security" style={{ paddingTop: 0 }}>
        <div className="pixel-terminal board-terminal">
          <div className="terminal-topline">
            <div className="terminal-brand"><span className="pixel-mark">◆</span><span>CITIZEN / SECURITY</span></div>
            <span className="terminal-status"><i /> TESTNET ONLY</span>
          </div>
          <div className="graduated-head">
            <div>
              <span className="pixel-kicker">SECURITY</span>
              <h2>Reviewed, verified, still testnet</h2>
              <p>What has been checked so far, and what has not — read both before you trade.</p>
            </div>
          </div>
          <div className="docs-list docs-list-2">
            <article className="docs-card docs-card-ok">
              <b>What has been done</b>
              <p>
                The launchpad source is verified on{" "}
                <a href={`${EXPLORER}/address/${LAUNCHPAD}`} target="_blank" rel="noreferrer">Arcscan</a>{" "}
                and published on{" "}
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>{" "}
                with its full test suite covering curve math, fee routing,
                graduation, buybacks and admin limits. The contracts have had an
                internal security review, and its findings are being resolved
                before any mainnet deployment.
              </p>
            </article>
            <article className="docs-card docs-card-warn">
              <b>What has not</b>
              <p>
                No independent third-party audit yet. Citizen runs on Arc testnet
                only: tokens are speculative test assets with no value, and the
                contracts must not be used to hold real funds until the review
                findings are fixed and an external audit is complete.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section shell token-board-section board-terminal-section" style={{ paddingTop: 0 }}>
        <div className="pixel-terminal board-terminal">
          <div className="terminal-topline">
            <div className="terminal-brand"><span className="pixel-mark">◆</span><span>CITIZEN / GET STARTED</span></div>
            <span className="terminal-status"><i /> LIVE ON ARC</span>
          </div>
          <div className="graduated-head">
            <div>
              <span className="pixel-kicker">GETTING STARTED</span>
              <h2>Three steps to your first trade</h2>
              <p>From an empty wallet to your first launch in under a minute.</p>
            </div>
          </div>
          <div className="docs-list docs-list-3">
            <article className="docs-card docs-step">
              <span className="docs-card-num">01</span>
              <b>Get testnet USDC</b>
              <p>
                Grab free testnet USDC from{" "}
                <a href={FAUCET} target="_blank" rel="noreferrer">Circle&apos;s faucet</a>{" "}
                (choose Arc Testnet). Gas on Arc is paid in USDC too, so that is
                all you need.
              </p>
            </article>
            <article className="docs-card docs-step">
              <span className="docs-card-num">02</span>
              <b>Connect a wallet</b>
              <p>
                Any injected EVM wallet such as MetaMask works. Citizen adds and
                switches to the Arc Testnet network (chain id 5042002) for you on
                first use.
              </p>
            </article>
            <article className="docs-card docs-step">
              <span className="docs-card-num">03</span>
              <b>Trade or launch</b>
              <p>
                Buy a coin from the <Link href="/app">board</Link>, or{" "}
                <Link href="/create">create your own</Link> for a cent. Your
                positions and claimable fees live in{" "}
                <Link href="/portfolio">portfolio</Link>.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section shell" style={{ paddingTop: 0 }}>
        <div className="cta-band">
          <div>
            <h2>Ready to launch on Arc?</h2>
            <p>Fair launch, on-chain, in one transaction. Creating a coin takes less than a minute.</p>
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
