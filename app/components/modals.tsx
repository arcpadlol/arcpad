"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { decodeEventLog, parseUnits } from "viem";
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
import { submitCoinMetadata, type CoinMetaFields } from "../lib/irys";
import type { CoinMeta } from "../lib/useMeta";
import { CoinAvatar, avatarStyle } from "./avatar";
import { ExternalLinkIcon } from "./chrome";

export { avatarStyle, CoinAvatar };

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden style={{ width: 13, height: 13 }}>
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
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

// ------------------------------------------------------------- metadata

const metaErrorText = (e: unknown) => {
  const raw = (e as Error)?.message ?? "";
  if (/rejected|denied/i.test(raw)) return "Signature rejected in wallet.";
  return "Could not store metadata right now. You can retry, or skip and add it later from the coin's trade window.";
};

function MetaFields({
  description, setDescription,
  website, setWebsite,
  x, setX,
  telegram, setTelegram,
  file, setFile,
}: {
  description: string; setDescription: (v: string) => void;
  website: string; setWebsite: (v: string) => void;
  x: string; setX: (v: string) => void;
  telegram: string; setTelegram: (v: string) => void;
  file: File | null; setFile: (f: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL lifecycle
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <>
      <div className="field">
        <span>Logo (optional, stored forever on Irys)</span>
        <label className="img-pick">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={preview} alt="logo preview" />
          ) : (
            <span className="img-pick-empty" aria-hidden>
              <svg viewBox="0 0 16 16" fill="none" style={{ width: 15, height: 15 }}>
                <rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="6" cy="6.2" r="1.3" fill="currentColor" />
                <path d="M3 12.5l3.2-3.4 2.4 2.3 2.2-2.6 2.2 2.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          <span className="img-pick-text">
            <b>{file ? file.name : "Choose an image"}</b>
            <small>PNG, JPG or WebP · compressed automatically, free under 100 KB</small>
          </span>
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <label className="field">
        <span>Description (optional)</span>
        <textarea
          rows={2}
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this coin about?"
        />
      </label>
      <div className="form-row">
        <label className="field">
          <span>Website (optional)</span>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" inputMode="url" />
        </label>
        <label className="field">
          <span>X link (optional)</span>
          <input value={x} onChange={(e) => setX(e.target.value)} placeholder="https://x.com/" inputMode="url" />
        </label>
      </div>
      <label className="field">
        <span>Telegram (optional)</span>
        <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/" inputMode="url" />
      </label>
    </>
  );
}

const cleanFields = (f: { description: string; website: string; x: string; telegram: string }): CoinMetaFields => ({
  description: f.description.trim() || undefined,
  website: f.website.trim() || undefined,
  x: f.x.trim() || undefined,
  telegram: f.telegram.trim() || undefined,
});

// ---------------------------------------------------------------- trade

export function TradeModal({
  coin,
  meta,
  wallet,
  onClose,
  onChanged,
  onMetaChanged,
}: {
  coin: CoinInfo;
  meta?: CoinMeta;
  wallet: ReturnType<typeof useWallet>;
  onClose: () => void;
  onChanged: () => void;
  onMetaChanged?: () => void;
}) {
  const { tx, run, reset } = useTx(wallet);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("25");
  const [quote, setQuote] = useState<bigint | null>(null);
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [tokenBal, setTokenBal] = useState<bigint | null>(null);

  const isCreator =
    !!wallet.account && wallet.account.toLowerCase() === coin.creator.toLowerCase();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(meta?.description ?? "");
  const [website, setWebsite] = useState(meta?.website ?? "");
  const [x, setX] = useState(meta?.x ?? "");
  const [telegram, setTelegram] = useState(meta?.telegram ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [metaState, setMetaState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [metaError, setMetaError] = useState("");

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

  const saveMeta = async () => {
    try {
      setMetaState("saving");
      setMetaError("");
      await submitCoinMetadata({
        token: coin.token,
        fields: cleanFields({ description, website, x, telegram }),
        imageFile: file,
        walletClient: wallet.walletClient()!,
        publicClient: publicClient as never,
      });
      setMetaState("done");
      setEditing(false);
      onMetaChanged?.();
    } catch (e) {
      setMetaState("error");
      setMetaError(metaErrorText(e));
    }
  };

  const busy = tx.step === "approving" || tx.step === "confirming" || tx.step === "pending";
  const links = [
    meta?.website ? (["Website", meta.website] as const) : null,
    meta?.x ? (["X", meta.x] as const) : null,
    meta?.telegram ? (["Telegram", meta.telegram] as const) : null,
  ].filter(Boolean) as ReadonlyArray<readonly [string, string]>;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal">
        <button className="modal-x" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
          <CoinAvatar symbol={coin.symbol} image={meta?.image} />
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>{coin.name}</h2>
            <span className="mono" style={{ color: "var(--blue)", fontWeight: 700, fontSize: 12 }}>
              ${coin.symbol} · {preset.name} vault
            </span>
          </div>
          {isCreator && !editing && (
            <button
              className="btn btn-sm btn-ghost"
              style={{ marginLeft: "auto" }}
              onClick={() => setEditing(true)}
            >
              Edit info
            </button>
          )}
        </div>

        {meta?.description && !editing && (
          <p className="sub" style={{ marginBottom: links.length ? 10 : 16 }}>{meta.description}</p>
        )}
        {links.length > 0 && !editing && (
          <div className="trust-row" style={{ justifyContent: "flex-start", margin: "0 0 16px" }}>
            {links.map(([label, href]) => (
              <a className="trust-chip" key={label} href={href} target="_blank" rel="noreferrer">
                {label} <ExternalLinkIcon />
              </a>
            ))}
          </div>
        )}

        {editing ? (
          <>
            <MetaFields
              description={description} setDescription={setDescription}
              website={website} setWebsite={setWebsite}
              x={x} setX={setX}
              telegram={telegram} setTelegram={setTelegram}
              file={file} setFile={setFile}
            />
            <div className="form-row">
              <button className="btn btn-outline" onClick={() => setEditing(false)} disabled={metaState === "saving"}>
                Cancel
              </button>
              <button className="btn btn-gold" onClick={saveMeta} disabled={metaState === "saving"}>
                {metaState === "saving" ? "Sign in wallet…" : "Save info"}
              </button>
            </div>
            {metaState === "error" && <div className="tx-note tx-error">{metaError}</div>}
            <p className="disclaimer">
              Stored permanently on Irys, free under 100 KB. Only the coin creator&apos;s
              wallet can update this info; changes show within a minute.
            </p>
          </>
        ) : coin.graduated ? (
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
            {metaState === "done" && (
              <div className="tx-note tx-done">Info saved. It will show within a minute.</div>
            )}
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
            {metaState === "done" && (
              <div className="tx-note tx-done">Info saved. It will show within a minute.</div>
            )}
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

  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [x, setX] = useState("");
  const [telegram, setTelegram] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [metaState, setMetaState] = useState<"idle" | "uploading" | "error">("idle");
  const [metaError, setMetaError] = useState("");
  const [createdToken, setCreatedToken] = useState<`0x${string}` | null>(null);

  const valid = useMemo(
    () => name.trim().length >= 2 && /^[A-Z0-9]{2,10}$/.test(symbol),
    [name, symbol]
  );

  const hasMeta = !!(file || description.trim() || website.trim() || x.trim() || telegram.trim());
  const busy = tx.step === "approving" || tx.step === "confirming" || tx.step === "pending";

  const pushMeta = async (token: `0x${string}`) => {
    try {
      setMetaState("uploading");
      setMetaError("");
      await submitCoinMetadata({
        token,
        fields: cleanFields({ description, website, x, telegram }),
        imageFile: file,
        walletClient: wallet.walletClient()!,
        publicClient: publicClient as never,
      });
      onCreated();
    } catch (e) {
      setMetaState("error");
      setMetaError(metaErrorText(e));
    }
  };

  const submit = async () => {
    if (!valid || busy || metaState === "uploading") return;
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
    if (!receipt) return;

    let token: `0x${string}` | null = null;
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: launchpadAbi, data: log.data, topics: log.topics });
        if (ev.eventName === "CoinCreated") {
          token = (ev.args as { token: `0x${string}` }).token;
          break;
        }
      } catch {
        // other contracts' logs in the same receipt
      }
    }

    if (!token || !hasMeta) {
      onCreated();
      return;
    }
    setCreatedToken(token);
    await pushMeta(token);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal">
        <button className="modal-x" aria-label="Close" onClick={onClose}><CloseIcon /></button>
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

        <MetaFields
          description={description} setDescription={setDescription}
          website={website} setWebsite={setWebsite}
          x={x} setX={setX}
          telegram={telegram} setTelegram={setTelegram}
          file={file} setFile={setFile}
        />

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

        {metaState === "error" && createdToken ? (
          <>
            <div className="tx-note tx-done">
              Coin deployed on Arc. Metadata is the only step left.
            </div>
            <div className="tx-note tx-error">{metaError}</div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <button className="btn btn-outline" onClick={onCreated}>Skip for now</button>
              <button className="btn btn-gold" onClick={() => pushMeta(createdToken)}>
                Retry metadata
              </button>
            </div>
          </>
        ) : (
          <button
            className="btn btn-gold btn-lg"
            style={{ width: "100%" }}
            disabled={!valid || busy || metaState === "uploading"}
            onClick={submit}
          >
            {metaState === "uploading"
              ? "Storing metadata, sign in wallet…"
              : wallet.connected
                ? "Deploy coin on Arc"
                : "Connect wallet to deploy"}
          </button>
        )}
        <TxNote tx={tx} />
        <p className="disclaimer">
          Creation fee $0.01 + gas (paid in testnet USDC) · logo and links stored
          permanently on Irys, free under 100 KB · contract{" "}
          <a href={`${EXPLORER}/address/${LAUNCHPAD}`} target="_blank" rel="noreferrer">
            verified on Arcscan
          </a>
        </p>
      </section>
    </div>
  );
}
