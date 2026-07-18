"use client";

import { EXPLORER, fmtUsd, short } from "../lib/arcpad";
import type { ActivityItem } from "../lib/useArcPad";
import { ExternalLinkIcon } from "./chrome";

const tagClass = (kind: ActivityItem["kind"]) =>
  kind === "buy" ? "act-buy" : kind === "sell" ? "act-sell" : kind === "graduate" ? "act-grad" : "act-create";

const detailText = (a: ActivityItem) =>
  a.kind === "create"
    ? `deployed by ${short(a.who)}`
    : a.kind === "graduate"
      ? "graduated to locked LP"
      : `by ${short(a.who)}`;

export function ActivityTable({
  activity,
  loading,
}: {
  activity: ActivityItem[];
  loading: boolean;
}) {
  if (activity.length === 0) {
    return (
      <div className="empty">
        <h3>{loading ? "Reading events from Arc…" : "No activity yet"}</h3>
        <p>{loading ? "Pulling recent on-chain events." : "Buys, sells, launches and graduations will show up here."}</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="coin-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Token</th>
            <th>Amount</th>
            <th>Account</th>
            <th aria-label="Transaction" />
          </tr>
        </thead>
        <tbody>
          {activity.map((a, i) => (
            <tr key={i}>
              <td><span className={`act-tag ${tagClass(a.kind)}`}>{a.kind.toUpperCase()}</span></td>
              <td>
                <span className="t-name">
                  <b>${a.symbol}</b>
                  <small>{detailText(a)}</small>
                </span>
              </td>
              <td className="mono">{a.kind === "create" ? "—" : fmtUsd(a.usdc ?? 0n)}</td>
              <td className="mono">{short(a.who)}</td>
              <td>
                {a.tx !== "0x" ? (
                  <a className="btn btn-sm btn-outline" href={`${EXPLORER}/tx/${a.tx}`} target="_blank" rel="noreferrer">
                    View tx <ExternalLinkIcon />
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
