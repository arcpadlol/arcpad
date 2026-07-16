"use client";

import { EXPLORER, fmtUsd, short } from "../lib/arcpad";
import type { ActivityItem } from "../lib/useArcPad";
import { ExternalLinkIcon } from "./chrome";

export function ActivityList({
  activity,
  loading,
}: {
  activity: ActivityItem[];
  loading: boolean;
}) {
  if (activity.length === 0) {
    return (
      <div className="act-row">
        <div className="act-main">
          <small>
            {loading ? "Reading events from Arc…" : "No activity in the recent window."}
          </small>
        </div>
      </div>
    );
  }

  return (
    <>
      {activity.map((a, i) => (
        <div className="act-row" key={i}>
          <span
            className={`act-tag ${
              a.kind === "buy"
                ? "act-buy"
                : a.kind === "sell"
                  ? "act-sell"
                  : a.kind === "graduate"
                    ? "act-grad"
                    : "act-create"
            }`}
          >
            {a.kind.toUpperCase()}
          </span>
          <div className="act-main">
            <b>${a.symbol}</b>
            <small>
              {a.kind === "create"
                ? `deployed by ${short(a.who)}`
                : a.kind === "graduate"
                  ? `${fmtUsd(a.usdc ?? 0n)} to locked LP`
                  : `${fmtUsd(a.usdc ?? 0n)} by ${short(a.who)}`}
            </small>
          </div>
          {a.tx !== "0x" && (
            <a className="act-link" href={`${EXPLORER}/tx/${a.tx}`} target="_blank" rel="noreferrer">
              tx <ExternalLinkIcon />
            </a>
          )}
        </div>
      ))}
    </>
  );
}
