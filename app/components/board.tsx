"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  EXPLORER,
  LAUNCHPAD,
  PRESETS,
  fmtPrice,
  fmtUsd,
  marketCap,
  short,
  type CoinInfo,
} from "../lib/arcpad";
import { useArcPadData, useWallet } from "../lib/useArcPad";
import { useMeta } from "../lib/useMeta";
import { avatarStyle, CreateModal } from "../components/modals";
import { CoinAvatar } from "../components/avatar";
import { ActivityList } from "../components/activity";
import { Footer, Notice, Topbar, TrendUpIcon } from "../components/chrome";

type Tab = "new" | "progress" | "graduated";
type View = "card" | "table" | "grid";

const tokenImage = (symbol: string) => ({
  SMO: "/tokens/arc-smoke.webp",
  WAG: "/tokens/wagmi-exe.webp",
  ARC: "/tokens/arc-signal.webp",
  PXL: "/tokens/pixel-protocol.webp",
}[symbol.toUpperCase()]);

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 13, height: 13 }}>
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 13, height: 13 }}>
      <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function RowsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 13, height: 13 }}>
      <rect x="2" y="2.5" width="12" height="3.2" rx="1.1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="10.3" width="12" height="3.2" rx="1.1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MosaicIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width:13,height:13 }}><rect x="2" y="2" width="12" height="7" rx="1.3" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="11" width="5.5" height="3" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="11" width="5" height="3" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StatusChip({ coin }: { coin: CoinInfo }) {
  return coin.graduated ? (
    <span className="chip chip-grad">GRADUATED</span>
  ) : (
    <span className="chip chip-live">CURVE LIVE</span>
  );
}

export function BoardApp({ initialCreate = false }: { initialCreate?: boolean }) {
  const router = useRouter();
  const wallet = useWallet();
  const { coins, activity, loading, error, reload } = useArcPadData();
  const { metas } = useMeta();
  const [tab, setTab] = useState<Tab>("new");
  const [view, setView] = useState<View>("card");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(initialCreate);

  useEffect(() => {
    if (!error) return;
    const retry = window.setTimeout(() => reload(), 4000);
    return () => window.clearTimeout(retry);
  }, [error, reload]);

  const list = useMemo(() => {
    let r = coins.filter((c) =>
      (c.name + c.symbol).toLowerCase().includes(query.toLowerCase())
    );
    if (tab === "new") r = r.slice(0, 20); // feed cap: 20 newest
    if (tab === "progress")
      r = [...r].filter((c) => !c.graduated).sort((a, b) => (a.progressBps > b.progressBps ? -1 : 1));
    if (tab === "graduated") r = r.filter((c) => c.graduated);
    return r;
  }, [coins, tab, query]);

  // Trending: most USDC volume in the recent activity window, from ALL
  // coins (not subject to the 20-newest feed cap).
  const trending = useMemo(() => {
    const vol = new Map<string, bigint>();
    for (const a of activity) {
      if (a.kind !== "buy" && a.kind !== "sell") continue;
      const k = a.token.toLowerCase();
      vol.set(k, (vol.get(k) ?? 0n) + (a.usdc ?? 0n));
    }
    return coins
      .map((coin) => ({ coin, vol: vol.get(coin.token.toLowerCase()) ?? 0n }))
      .filter((x) => x.vol > 0n)
      .sort((a, b) => (b.vol > a.vol ? 1 : b.vol < a.vol ? -1 : 0))
      .slice(0, 5);
  }, [coins, activity]);

  return (
    <main className="app">
      <Notice />
      <Topbar wallet={wallet} />

      <section className="section shell token-board-section" id="board">
        <div className="section-head">
          <h2>Coin board</h2>
          <span className="count">
            {loading ? "reading Arc…" : `${list.length} markets · data from chain`}
          </span>
          <span className="spacer" />
          <label className="search">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or ticker"
            />
          </label>
          <button className="btn btn-gold" onClick={() => setCreating(true)}>
            <PlusIcon /> Create coin
          </button>
        </div>

        {trending.length > 0 && (
          <div className="trend-strip">
            <span className="trend-label">
              <TrendUpIcon />
              TRENDING
            </span>
            {trending.map((t, i) => (
              <button className="trend-card" key={t.coin.token} onClick={() => router.push(`/token/${t.coin.token}`)}>
                <span className="trend-rank">#{i + 1}</span>
                <CoinAvatar symbol={t.coin.symbol} image={metas[t.coin.token.toLowerCase()]?.image} />
                <span className="trend-main">
                  <b>{t.coin.name}</b>
                  <small>${t.coin.symbol}</small>
                </span>
                <span className="trend-vol">
                  <small>VOL</small>
                  <b>{fmtUsd(t.vol)}</b>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="tabs-row">
          <div className="tabs">
            <button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>
              Newest
            </button>
            <button className={tab === "progress" ? "active" : ""} onClick={() => setTab("progress")}>
              Near graduation
            </button>
            <button className={tab === "graduated" ? "active" : ""} onClick={() => setTab("graduated")}>
              Graduated
            </button>
          </div>
          <div className="view-toggle">
            <button className={view === "card" ? "active" : ""} onClick={() => setView("card")}>
              <GridIcon /> Cards
            </button>
            <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>
              <RowsIcon /> Table
            </button>
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
              <MosaicIcon /> Grid
            </button>
          </div>
        </div>

        {error && (
          <div className="rpc-reconnect" role="status" aria-live="polite">
            <i aria-hidden="true" />
            Arc RPC reconnecting…
          </div>
        )}

        <div className="board-grid">
          <div>
            {!error && !loading && list.length === 0 && (
              <div className="empty">
                <h3>No markets here yet</h3>
                <p>Be the first: deploy a coin and open its curve in one transaction.</p>
                <button className="btn btn-gold" onClick={() => setCreating(true)}>
                  Create the first coin
                </button>
              </div>
            )}

            {view === "card" ? (
              <div className="coin-grid board-token-grid">
                {list.map((c) => (
                  <button className="coin-card board-coin-card" key={c.token} onClick={() => router.push(`/token/${c.token}`)}>
                    <div className="coin-top">
                      <CoinAvatar symbol={c.symbol} image={metas[c.token.toLowerCase()]?.image} />
                      <div className="coin-title">
                        <strong>{c.name}</strong>
                        <span>${c.symbol}</span>
                      </div>
                      <div className="coin-flags">
                        <span className="chip chip-vault">
                          {(PRESETS[c.preset] ?? PRESETS[0]).name} vault
                        </span>
                        <StatusChip coin={c} />
                      </div>
                    </div>
                    <div className="coin-data">
                      <div>
                        <span>Price</span>
                        <b>{fmtPrice(c.price)}</b>
                      </div>
                      <div>
                        <span>Market cap</span>
                        <b>{fmtUsd(marketCap(c.price) / 10n ** 18n)}</b>
                      </div>
                      <div>
                        <span>Raised</span>
                        <b>{fmtUsd(c.realUsdc)}</b>
                      </div>
                    </div>
                    <div className="bond">
                      <div className="bond-label">
                        <span>Bonding curve</span>
                        <b>{(Number(c.progressBps) / 100).toFixed(1)}%</b>
                      </div>
                      <div className="bond-track">
                        <i
                          className="bond-fill"
                          style={{ width: `${Math.min(100, Number(c.progressBps) / 100)}%`, display: "block" }}
                        />
                      </div>
                    </div>
                    <div className="coin-foot">
                      <span>by <span className="mono">{short(c.creator)}</span></span>
                      <span>target {fmtUsd(c.raiseTarget, 0)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : view === "grid" ? (
              <div className="launch-grid">
                {list.map((c) => {
                  const image = tokenImage(c.symbol);
                  return <button className="launch-grid-card" key={c.token} onClick={() => router.push(`/token/${c.token}`)}>
                    <div className="launch-grid-art">
                      {image ? <Image src={image} alt={c.name} fill sizes="(max-width: 700px) 92vw, 280px" /> : <span style={avatarStyle(c.symbol)}>{c.symbol.slice(0,3)}</span>}
                      <StatusChip coin={c}/>
                    </div>
                    <div className="launch-grid-copy">
                      <strong>{c.name}</strong><small>${c.symbol} · {(PRESETS[c.preset] ?? PRESETS[0]).name} vault</small>
                      <div className="launch-grid-numbers"><span><small>MARKET CAP</small><b>{fmtUsd(marketCap(c.price)/10n**18n)}</b></span><span><small>RAISED</small><b>{fmtUsd(c.realUsdc)}</b></span></div>
                      <div className="bond-label"><span>Bonding progress</span><b>{(Number(c.progressBps)/100).toFixed(1)}%</b></div>
                      <div className="bond-track"><i className="bond-fill" style={{width:`${Math.min(100,Number(c.progressBps)/100)}%`,display:"block"}}/></div>
                    </div>
                  </button>;
                })}
              </div>
            ) : (
              list.length > 0 && (
                <div className="table-wrap">
                  <table className="coin-table">
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Price</th>
                        <th>Market cap</th>
                        <th>Raised</th>
                        <th>Curve</th>
                        <th>Vault</th>
                        <th>Status</th>
                        <th aria-label="Action" />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((c) => (
                        <tr key={c.token} onClick={() => router.push(`/token/${c.token}`)}>
                          <td>
                            <div className="t-token">
                              <CoinAvatar symbol={c.symbol} image={metas[c.token.toLowerCase()]?.image} />
                              <span className="t-name">
                                <b>{c.name}</b>
                                <small>${c.symbol}</small>
                              </span>
                            </div>
                          </td>
                          <td className="mono">{fmtPrice(c.price)}</td>
                          <td className="mono">{fmtUsd(marketCap(c.price) / 10n ** 18n)}</td>
                          <td className="mono">{fmtUsd(c.realUsdc)}</td>
                          <td>
                            <div className="t-curve">
                              <span className="bond-track">
                                <i
                                  className="bond-fill"
                                  style={{ width: `${Math.min(100, Number(c.progressBps) / 100)}%`, display: "block" }}
                                />
                              </span>
                              <span className="mono t-pct">
                                {(Number(c.progressBps) / 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="chip chip-vault">
                              {(PRESETS[c.preset] ?? PRESETS[0]).name}
                            </span>
                          </td>
                          <td><StatusChip coin={c} /></td>
                          <td>
                            <span className="btn btn-sm btn-outline">Trade</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          <aside className="aside-card" id="activity">
            <div className="aside-head">
              <span>ON-CHAIN ACTIVITY</span>
              <i className="dot" />
            </div>
            <ActivityList activity={activity} loading={loading} />
          </aside>
        </div>
      </section>

      <Footer launchpad={LAUNCHPAD} explorer={EXPLORER} />

      {creating && (
        <CreateModal
          wallet={wallet}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </main>
  );
}
