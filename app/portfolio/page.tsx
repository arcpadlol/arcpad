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
import { useMeta } from "../lib/useMeta";
import { TradeModal } from "../components/modals";
import { CoinAvatar } from "../components/avatar";
import { Footer, Notice, Topbar } from "../components/chrome";

/** Estimated curve value of a balance, in 6d USDC units. */
const positionValue = (price6: bigint, bal18: bigint) => (price6 * bal18) / 10n ** 18n;

export default function PortfolioPage() {
  const wallet = useWallet();
  const { coins, loading, reload } = useArcPadData();
  const { metas, refreshMetas } = useMeta();
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

      <section className="section shell token-board-section board-terminal-section">
        <div className="pixel-terminal board-terminal">
          <div className="terminal-topline">
            <div className="terminal-brand"><span className="pixel-mark">◆</span><span>CITIZEN / PORTFOLIO</span></div>
            <span className="terminal-status"><i /> LIVE ON ARC</span>
          </div>
          <div className="graduated-head">
            <div>
              <span className="pixel-kicker">YOUR POSITIONS</span>
              <h2>Portfolio</h2>
              <p>
                {wallet.connected
                  ? loading || reading
                    ? "Reading your positions from Arc…"
                    : "Your live curve positions and claimable vault fees, enforced on-chain."
                  : "Connect a wallet to see your positions."}
              </p>
            </div>
            <div className="terminal-count"><strong>{String(holdings.length).padStart(2, "0")}</strong><span>POSITIONS</span></div>
          </div>

          {!wallet.connected ? (
            <div className="empty">
              <h3>No wallet connected</h3>
              <p>Connect an injected wallet to see your Citizen coins and claimable vault fees.</p>
              <button className="btn btn-primary" onClick={wallet.connect}>Connect wallet</button>
            </div>
          ) : (
            <>
              <div className="claim-strip">
                <div className="claim-main">
                  <b>Claimable vault fees</b>
                  <small>Your share of trading fees, routed by each coin&apos;s vault preset.</small>
                </div>
                <span className="claim-amount mono">{claimable === null ? "…" : fmtUsd(claimable)}</span>
                <button className="btn btn-sm btn-gold" disabled={busy || !claimable} onClick={claim}>
                  Claim USDC
                </button>
              </div>
              {tx.step === "done" && (
                <div className="tx-note tx-done">
                  Fees claimed.{" "}
                  <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">View on Arcscan</a>
                </div>
              )}
              {tx.step === "error" && <div className="tx-note tx-error">{tx.message}</div>}

              {holdings.length === 0 && !loading && !reading ? (
                <div className="empty">
                  <h3>No positions yet</h3>
                  <p>Buy a coin on the board and it will show up here.</p>
                  <a className="btn btn-gold" href="/app">Open the board</a>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="coin-table">
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Balance</th>
                        <th>Status</th>
                        <th>Est. value</th>
                        <th aria-label="Action" />
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((c) => (
                        <tr key={c.token}>
                          <td>
                            <div className="t-token">
                              <CoinAvatar symbol={c.symbol} image={metas[c.token.toLowerCase()]?.image} />
                              <span className="t-name">
                                <b>{c.name}</b>
                                <small>${c.symbol}</small>
                              </span>
                            </div>
                          </td>
                          <td className="mono">{fmtToken(balances[c.token] ?? 0n)}</td>
                          <td>
                            <span className={`chip ${c.graduated ? "chip-grad" : "chip-live"}`}>
                              {c.graduated ? "GRADUATED" : "ON CURVE"}
                            </span>
                          </td>
                          <td className="mono">{fmtUsd(positionValue(c.price, balances[c.token] ?? 0n))}</td>
                          <td>
                            <button className="btn btn-sm btn-outline" onClick={() => setSelected(c)}>Trade</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="terminal-footer">
            <span>01 — 01</span>
            <span className="terminal-dots">● ○ ○</span>
            <a href="/app">Back to board ↗</a>
          </div>
        </div>
      </section>

      <Footer launchpad={LAUNCHPAD} explorer={EXPLORER} />

      {selected && (
        <TradeModal
          coin={selected}
          meta={metas[selected.token.toLowerCase()]}
          wallet={wallet}
          onClose={() => setSelected(null)}
          onChanged={() => {
            reload();
            loadPositions();
          }}
          onMetaChanged={refreshMetas}
        />
      )}
    </main>
  );
}
