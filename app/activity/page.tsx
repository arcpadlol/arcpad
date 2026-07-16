"use client";

import { EXPLORER, LAUNCHPAD } from "../lib/arcpad";
import { useArcPadData, useWallet } from "../lib/useArcPad";
import { ActivityList } from "../components/activity";
import { Footer, Notice, Topbar } from "../components/chrome";

export default function ActivityPage() {
  const wallet = useWallet();
  const { activity, loading, error, reload } = useArcPadData();

  return (
    <main className="app">
      <Notice />
      <Topbar wallet={wallet} />

      <section className="section shell">
        <span className="section-kicker">Live from the chain</span>
        <div className="section-head">
          <h2>Activity</h2>
          <span className="count">
            {loading ? "reading Arc…" : `${activity.length} events in the recent window`}
          </span>
        </div>
        {error ? (
          <div className="empty">
            <h3>Could not reach Arc</h3>
            <p>{error}</p>
            <button className="btn btn-outline" onClick={reload}>Retry</button>
          </div>
        ) : (
          <div className="aside-card" style={{ maxWidth: 760 }}>
            <div className="aside-head">
              <span>ON-CHAIN ACTIVITY</span>
              <span style={{ color: "var(--green)" }}>●</span>
            </div>
            <ActivityList activity={activity} loading={loading} />
          </div>
        )}
      </section>

      <Footer launchpad={LAUNCHPAD} explorer={EXPLORER} />
    </main>
  );
}
