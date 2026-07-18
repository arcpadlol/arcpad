"use client";

import { EXPLORER, LAUNCHPAD } from "../lib/arcpad";
import { useArcPadData, useWallet } from "../lib/useArcPad";
import { ActivityTable } from "../components/activity";
import { Footer, Notice, Topbar } from "../components/chrome";

export default function ActivityPage() {
  const wallet = useWallet();
  const { activity, loading, error, reload } = useArcPadData();

  return (
    <main className="app">
      <Notice />
      <Topbar wallet={wallet} />

      <section className="section shell token-board-section board-terminal-section">
        <div className="pixel-terminal board-terminal">
          <div className="terminal-topline">
            <div className="terminal-brand"><span className="pixel-mark">◆</span><span>CITIZEN / ACTIVITY</span></div>
            <span className="terminal-status"><i /> LIVE ON ARC</span>
          </div>
          <div className="graduated-head">
            <div>
              <span className="pixel-kicker">LIVE FROM THE CHAIN</span>
              <h2>Activity</h2>
              <p>{loading ? "Reading events from Arc…" : "Every buy, sell, launch and graduation, straight from the chain."}</p>
            </div>
            <div className="terminal-count"><strong>{String(activity.length).padStart(2, "0")}</strong><span>EVENTS</span></div>
          </div>
          {error ? (
            <div className="empty">
              <h3>Could not reach Arc</h3>
              <p>{error}</p>
              <button className="btn btn-outline" onClick={reload}>Retry</button>
            </div>
          ) : (
            <ActivityTable activity={activity} loading={loading} />
          )}
          <div className="terminal-footer">
            <span>01 — 01</span>
            <span className="terminal-dots">● ○ ○</span>
            <a href="/app">Back to board ↗</a>
          </div>
        </div>
      </section>

      <Footer launchpad={LAUNCHPAD} explorer={EXPLORER} />
    </main>
  );
}
