"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import {
  publicClient,
  launchpadAbi,
  erc20Abi,
  LAUNCHPAD,
  USDC,
  EXPLORER,
  FAUCET,
  PRESETS,
  RAISE_TIERS,
  arcTestnet,
  fmtUsd,
  fmtToken,
  type CoinInfo,
} from "../lib/arcpad";
import { useTx, useWallet, type TxState } from "../lib/useArcPad";

const AVATAR_BG = [
  "linear-gradient(135deg,#0d1b30,#0c79d8)",
  "linear-gradient(135deg,#0a5fa8,#2e9eff)",
  "linear-gradient(135deg,#b97b17,#edaa3f)",
  "linear-gradient(135deg,#0f3a63,#68c4ff)",
];

export function avatarStyle(symbol: string) {
  const i = (symbol.charCodeAt(0) + (symbol.charCodeAt(1) || 0)) % AVATAR_BG.length;
  return { background: AVATAR_BG[i] };
}

function TxNote({ tx }: { tx: TxState }) {
  if (tx.step === "idle") return null;
  if (tx.step === "done")
    return (
      <div className="tx-note tx-done">
        Confirmed on Arc.{" "}
        <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
          View on Arcscan
        </a>
      </div>
    );
  if (tx.step === "error") return <div className="tx-note tx-error">{tx.message}</div>;
  const label =
    tx.step === "approving"
      ? "Approving USDC in your wallet…"
      : tx.step === "confirming"
        ? "Confirm the transaction in your wallet…"
        : "Waiting for confirmation on Arc…";
  return <div className="tx-note tx-pending">{label}</div>;
}

// ---------------------------------------------------------------- trade

export function TradeModal({
  coin,
  wallet,
  onClose,
  onChanged,
}: {
  coin: CoinInfo;
  wallet: ReturnType<typeof useWallet>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { tx, run, reset } = useTx(wallet);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("25");
  const [quote, setQuote] = useState<bigint | null>(null);
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [tokenBal, setTokenBal] = useState<bigint | null>(null);

  const preset = PRESETS[coin.preset] ?? PRESETS[0];

  const loadBalances = useCallback(async () => {
    if (!wallet.account) return;
    const [u, t] = await publicClient.multicall({
      contracts: [
        { address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [wallet.account] },
        { address: coin.token, abi: erc20Abi, functionName: "balanceOf", args: [wallet.account] },
      ],
      allowFailure: false,
    });
    setUsdcBal(u as bigint);
    setTokenBal(t as bigint);
  }, [wallet.account, coin.token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async chain, no cascading render
    loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    let stale = false;
    const n = Number(amount);
    if (!amount || isNaN(n) || n <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale quote
      setQuote(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        if (side === "buy") {
          const [tokensOut] = (await publicClient.readContract({
            address: LAUNCHPAD,
            abi: launchpadAbi,
            functionName: "quoteBuy",
            args: [coin.token, parseUnits(amount, 6)],
          })) as [bigint, bigint];
          if (!stale) setQuote(tokensOut);
        } else {
          const usdcOut = (await publicClient.readContract({
            address: LAUNCHPAD,
            abi: launchpadAbi,
            functionName: "quoteSell",
            args: [coin.token, parseUnits(amount, 18)],
          })) as bigint;
          if (!stale) setQuote(usdcOut);
        }
      } catch {
        if (!stale) setQuote(null);
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [amount, side, coin.token]);

  const submit = async () => {
    const n = Number(amount);
    if (isNaN(n) || n <= 0 || quote === null) return;
    const receipt =
      side === "buy"
        ? await run({
            approvals: [
              {
                token: USDC,
                amount: parseUnits(amount, 6),
                unlimited: parseUnits("1000000", 6),
              },
            ],
            write: async () => {
              const client = wallet.walletClient()!;
              return client.writeContract({
                address: LAUNCHPAD,
                abi: launchpadAbi,
                functionName: "buy",
                args: [coin.token, parseUnits(amount, 6), (quote * 98n) / 100n],
                account: wallet.account!,
                chain: arcTestnet,
              });
            },
          })
        : await run({
            approvals: [{ token: coin.token, amount: parseUnits(amount, 18) }],
            write: async () => {
              const client = wallet.walletClient()!;
              return client.writeContract({
                address: LAUNCHPAD,
                abi: launchpadAbi,
                functionName: "sell",
                args: [coin.token, parseUnits(amount, 18), (quote * 98n) / 100n],
                account: wallet.account!,
                chain: arcTestnet,
              });
            },
          });
    if (receipt) {
      loadBalances();
      onChanged();
    }
  };

  const busy = tx.step === "approving" || tx.step === "confirming" || tx.step === "pending";

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal">
        <button className="modal-x" aria-label="Close" onClick={onClose}><svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 13, height: 13 }}><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <div className="coin-avatar" style={avatarStyle(coin.symbol)}>
            {coin.symbol.slice(0, 3)}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>{coin.name}</h2>
            <span className="mono" style={{ color: "var(--blue)", fontWeight: 700, fontSize: 12 }}>
              ${coin.symbol} · {preset.name} vault
            </span>
          </div>
        </div>

        {coin.graduated ? (
          <>
            <p className="sub">
              This market has graduated. Its liquidity now lives in a locked
              UNITFLOW pool on Arc; the bonding curve is closed.
            </p>
            <a
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              href={`${EXPLORER}/address/${coin.pool}`}
              target="_blank"
              rel="noreferrer"
            >
              View pool on Arcscan
            </a>
          </>
        ) : (
          <>
            <div className="trade-tabs">
              <button
                className={`buy ${side === "buy" ? "active" : ""}`}
                onClick={() => { setSide("buy"); setAmount("25"); reset(); }}
              >
                Buy
              </button>
              <button
                className={`sell ${side === "sell" ? "active" : ""}`}
                onClick={() => { setSide("sell"); setAmount(""); reset(); }}
              >
                Sell
              </button>
            </div>

            <label className="field">
              <span>
                {side === "buy" ? "You pay (USDC)" : `You sell (${coin.symbol})`}
                {side === "buy" && usdcBal !== null && (
                  <em style={{ float: "right", textTransform: "none" }}>
                    balance {fmtUsd(usdcBal)}
                  </em>
                )}
                {side === "sell" && tokenBal !== null && (
                  <em style={{ float: "right", textTransform: "none" }}>
                    balance {fmtToken(tokenBal)}
                  </em>
                )}
              </span>
              <input
                value={amount}
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
              />
            </label>

            <div className="quick">
              {side === "buy"
                ? [5, 10, 25, 50].map((v) => (
                    <button key={v} onClick={() => setAmount(String(v))}>${v}</button>
                  ))
                : [25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() =>
                        tokenBal !== null &&
                        setAmount((Number(tokenBal / 10n ** 12n) / 1e6 * (p / 100)).toFixed(4))
                      }
                    >
                      {p}%
                    </button>
                  ))}
            </div>

            <div className="quote-box">
              <span>{side === "buy" ? "You receive (est.)" : "You receive (est.)"}</span>
              <div>
                {quote === null
                  ? "…"
                  : side === "buy"
                    ? `${fmtToken(quote)} ${coin.symbol}`
                    : fmtUsd(quote)}
              </div>
            </div>

            <button
              className={`btn btn-lg ${side === "buy" ? "btn-gold" : "btn-outline"}`}
              style={{ width: "100%" }}
              disabled={busy || quote === null}
              onClick={submit}
            >
              {wallet.connected
                ? side === "buy"
                  ? `Buy ${coin.symbol}`
                  : `Sell ${coin.symbol}`
                : "Connect wallet"}
            </button>
            <TxNote tx={tx} />
            <p className="disclaimer">
              Arc testnet market · 1.5% trade fee routed on-chain ({preset.split}, plus 0.5% platform) ·
              testnet USDC from{" "}
              <a href={FAUCET} target="_blank" rel="noreferrer">faucet.circle.com</a>
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- create

export function CreateModal({
  wallet,
  onClose,
  onCreated,
}: {
  wallet: ReturnType<typeof useWallet>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { tx, run } = useTx(wallet);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [preset, setPreset] = useState(0);
  const [tier, setTier] = useState(3_000);

  const valid = useMemo(
    () => name.trim().length >= 2 && /^[A-Z0-9]{2,10}$/.test(symbol),
    [name, symbol]
  );

  const busy = tx.step === "approving" || tx.step === "confirming" || tx.step === "pending";

  const submit = async () => {
    if (!valid) return;
    const receipt = await run({
      approvals: [{ token: USDC, amount: 10_000n, unlimited: parseUnits("1000000", 6) }],
      write: async () => {
        const client = wallet.walletClient()!;
        return client.writeContract({
          address: LAUNCHPAD,
          abi: launchpadAbi,
          functionName: "createCoin",
          args: [
            name.trim(),
            symbol,
            preset,
            parseUnits(String(tier), 6),
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
          ],
          account: wallet.account!,
          chain: arcTestnet,
        });
      },
    });
    if (receipt) onCreated();
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal">
        <button className="modal-x" aria-label="Close" onClick={onClose}><svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 13, height: 13 }}><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
        <span className="overline">Create on ArcPad</span>
        <h2>Turn a meme into a market</h2>
        <p className="sub">
          1,000,000,000 supply. 80% sold on a USDC bonding curve, 20% paired as
          locked DEX liquidity at graduation.
        </p>

        <div className="form-row">
          <label className="field">
            <span>Coin name</span>
            <input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="Arc Cat" />
          </label>
          <label className="field">
            <span>Ticker</span>
            <input
              value={symbol}
              maxLength={10}
              onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="ACAT"
            />
          </label>
        </div>

        <div className="field">
          <span>Fee vault preset (routes 1% of every trade)</span>
          <div className="option-grid">
            {PRESETS.map((p) => (
              <button key={p.key} className={`option ${preset === p.key ? "active" : ""}`} onClick={() => setPreset(p.key)}>
                <b>{p.name}</b>
                <small>{p.split}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Graduation target (USDC raised on the curve)</span>
          <div className="option-grid">
            {RAISE_TIERS.map((t) => (
              <button key={t} className={`option ${tier === t ? "active" : ""}`} onClick={() => setTier(t)}>
                <span className="mono-num">${t.toLocaleString("en")}</span>
                <small>graduates to a locked UNITFLOW pool</small>
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-gold btn-lg"
          style={{ width: "100%" }}
          disabled={!valid || busy}
          onClick={submit}
        >
          {wallet.connected ? "Deploy coin on Arc" : "Connect wallet to deploy"}
        </button>
        <TxNote tx={tx} />
        <p className="disclaimer">
          Creation fee $0.01 + gas (paid in testnet USDC) · contract{" "}
          <a href={`${EXPLORER}/address/${LAUNCHPAD}`} target="_blank" rel="noreferrer">
            verified on Arcscan
          </a>
        </p>
      </section>
    </div>
  );
}
