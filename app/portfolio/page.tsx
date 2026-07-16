"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EXPLORER,
  LAUNCHPAD,
  arcTestnet,
  erc20Abi,
  fmtToken,
  fmtUsd,
  launchpadAbi,
  publicClient,
  type CoinInfo,
} from "../lib/arcpad";
import { useArcPadData, useTx, useWallet } from "../lib/useArcPad";
import { avatarStyle, TradeModal } from "../components/modals";
import { Footer, Notice, Topbar } from "../components/chrome";

/** Estimated curve value of a balance, in 6d USDC units. */
const positionValue = (price6: bigint, bal18: bigint) => (price6 * bal18) / 10n ** 18n;

export default function PortfolioPage() {
  const wallet = useWallet();
  const { coins, loading, reload } = useArcPadData();
  const { tx, run } = useTx(wallet);

  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [claimable, setClaimable] = useState<bigint | null>(null);
  const [reading, setReading] = useState(false);
  const [selected, setSelected] = useState<CoinInfo | null>(null);

  const loadPositions = useCallback(async () => {
    if (!wallet.account || coins.length === 0) return;
    setReading(true);
    try {
      const results = (await publicClient.multicall({
        contracts: [
          ...coins.map((c) => ({
            address: c.token,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [wallet.account] as const,
          })),
          {
            address: LAUNCHPAD,
            abi: launchpadAbi,
            functionName: "claimableFees" as const,
            args: [wallet.account] as const,
          },
        ] as never,
        allowFailure: false,
      })) as bigint[];
      const next: Record<string, bigint> = {};
      coins.forEach((c, i) => {
        next[c.token] = results[i];
      });
      setBalances(next);
      setClaimable(results[coins.length]);
    } catch {
      // keep previous values; board-level errors already surface elsewhere
    } finally {
      setReading(false);
    }
  }, [wallet.account, coins]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async chain, no cascading render
    loadPositions();
  }, [loadPositions]);

  const holdings = coins.filter((c) => (balances[c.token] ?? 0n) > 0n);
  const totalValue = holdings.reduce(
    (s, c) => s + positionValue(c.price, balances[c.token] ?? 0n),
    0n
  );

  const claim = async () => {
    const receipt = await run({
      write: async () => {
        const client = wallet.walletClient()!;
        return client.writeContract({
          address: LAUNCHPAD,
          abi: launchpadAbi,
          functionName: "claimFees",
          account: wallet.account!,
          chain: arcTestnet,
        });
      },
    });
    if (receipt) loadPositions();
  };

  const busy = tx.step === "approving" || tx.step === "confirming" || tx.step === "pending";

  return (
    <main className="app">
      <Notice />
      <Topbar wallet={wallet} />

      <section className="section shell">
        <span className="section-kicker">Your positions</span>
        <div className="section-head">
          <h2>Portfolio</h2>
          <span className="count">
            {wallet.connected
              ? loading || reading
                ? "reading Arc…"
                : `${holdings.length} positions · est. ${fmtUsd(totalValue)}`
              : "connect a wallet to see your positions"}
          </span>
        </div>

        {!wallet.connected ? (
          <div className="empty">
            <h3>No wallet connected</h3>
            <p>Connect an injected wallet to see your ArcPad coins and claimable vault fees.</p>
            <button className="btn btn-primary" onClick={wallet.connect}>Connect wallet</button>
          </div>
        ) : (
          <>
            <div className="aside-card" style={{ maxWidth: 760, marginBottom: 20 }}>
              <div className="act-row">
                <div className="act-main">
                  <b style={{ fontFamily: "var(--font-body)" }}>Claimable vault fees</b>
                  <small>
                    Your share of trading fees, routed by each coin&apos;s vault preset.
                  </small>
                </div>
                <span className="mono" style={{ fontWeight: 700, color: "var(--navy)" }}>
                  {claimable === null ? "…" : fmtUsd(claimable)}
                </span>
                <button
                  className="btn btn-sm btn-gold"
                  disabled={busy || !claimable}
                  onClick={claim}
                >
                  Claim USDC
                </button>
              </div>
              {tx.step === "done" && (
                <div className="act-row">
                  <div className="tx-note tx-done" style={{ margin: 0, width: "100%" }}>
                    Fees claimed.{" "}
                    <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
                      View on Arcscan
                    </a>
                  </div>
                </div>
              )}
              {tx.step === "error" && (
                <div className="act-row">
                  <div className="tx-note tx-error" style={{ margin: 0, width: "100%" }}>
                    {tx.message}
                  </div>
                </div>
              )}
            </div>

            {holdings.length === 0 && !loading && !reading ? (
              <div className="empty">
                <h3>No positions yet</h3>
                <p>Buy a coin on the board and it will show up here.</p>
                <a className="btn btn-gold" href="/app">Open the board</a>
              </div>
            ) : (
              <div className="aside-card" style={{ maxWidth: 760 }}>
                <div className="aside-head">
                  <span>HOLDINGS</span>
                  <span>{loading || reading ? "…" : `EST. ${fmtUsd(totalValue)}`}</span>
                </div>
                {holdings.map((c) => (
                  <div className="act-row" key={c.token}>
                    <div className="coin-avatar" style={{ ...avatarStyle(c.symbol), width: 38, height: 38, borderRadius: 11, fontSize: 12.5 }}>
                      {c.symbol.slice(0, 3)}
                    </div>
                    <div className="act-main">
                      <b>{c.name}</b>
                      <small>
                        {fmtToken(balances[c.token] ?? 0n)} ${c.symbol}
                        {c.graduated ? " · graduated" : " · on curve"}
                      </small>
                    </div>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--navy)" }}>
                      {fmtUsd(positionValue(c.price, balances[c.token] ?? 0n))}
                    </span>
                    <button className="btn btn-sm btn-outline" onClick={() => setSelected(c)}>
                      Trade
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <Footer launchpad={LAUNCHPAD} explorer={EXPLORER} />

      {selected && (
        <TradeModal
          coin={selected}
          wallet={wallet}
          onClose={() => setSelected(null)}
          onChanged={() => {
            reload();
            loadPositions();
          }}
        />
      )}
    </main>
  );
}
