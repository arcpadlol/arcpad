import { decodeEventLog } from "viem";
import { LAUNCHPAD, launchpadAbi } from "../../lib/arcpad";

// Server-side, cached activity feed. Reading event logs from the browser was
// hitting the Arc public RPC's aggressive per-IP rate limit (HTTP 200 with
// {"code":-32011,"request limit reached"}): every visitor's getLogs went out
// through this one Vercel function's IP, and three separate getLogs per board
// refresh tripped it constantly. Here we make ONE getLogs over the launchpad
// address, decode all three event types from it, retry the rate-limit
// response with backoff, and cache the result so all visitors share it.

const ARC_RPC = "https://rpc.testnet.arc.network";
const DEPLOY_BLOCK = 52_811_000n;
/** Arc public RPC caps eth_getLogs at a 10,000 block range. */
const LOG_WINDOW = 9_500n;
const CACHE_MS = 25_000;

type Act = {
  kind: "buy" | "sell" | "create" | "graduate";
  token: string;
  usdc: string; // 6d, stringified bigint
  who: string;
  block: number;
  tx: string;
};

let cache: { at: number; data: Act[] } | null = null;
let inflight: Promise<Act[]> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST to the Arc RPC, retrying the HTTP-200 "-32011 request limit reached"
    response with exponential backoff. */
async function arcCall(body: string): Promise<unknown> {
  let text = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await sleep(350 * 2 ** (attempt - 1));
    const res = await fetch(ARC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    text = await res.text();
    if (res.ok && !text.includes('"code":-32011')) return JSON.parse(text);
  }
  throw new Error("Arc RPC rate-limited");
}

async function build(): Promise<Act[]> {
  const bn = (await arcCall(
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })
  )) as { result: string };
  const latest = BigInt(bn.result);
  const from = latest - LOG_WINDOW > DEPLOY_BLOCK ? latest - LOG_WINDOW : DEPLOY_BLOCK;

  const res = (await arcCall(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [
        {
          address: LAUNCHPAD,
          fromBlock: "0x" + from.toString(16),
          toBlock: "0x" + latest.toString(16),
        },
      ],
    })
  )) as { result?: Array<{ data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]]; blockNumber: string; transactionHash: string }> };

  const logs = res.result ?? [];
  const acts: Act[] = [];
  for (const l of logs) {
    let ev: { eventName: string; args: Record<string, unknown> };
    try {
      ev = decodeEventLog({ abi: launchpadAbi, data: l.data, topics: l.topics }) as never;
    } catch {
      continue; // not one of our events
    }
    const block = Number(BigInt(l.blockNumber));
    const tx = l.transactionHash;
    const a = ev.args;
    if (ev.eventName === "CoinCreated") {
      acts.push({ kind: "create", token: String(a.token), usdc: "0", who: String(a.creator), block, tx });
    } else if (ev.eventName === "Trade") {
      acts.push({
        kind: a.isBuy ? "buy" : "sell",
        token: String(a.token),
        usdc: String(a.usdcAmount),
        who: String(a.trader),
        block,
        tx,
      });
    } else if (ev.eventName === "Graduated") {
      acts.push({ kind: "graduate", token: String(a.token), usdc: String(a.usdcToLp), who: String(a.token), block, tx });
    }
  }
  acts.sort((x, y) => y.block - x.block);
  return acts.slice(0, 24);
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      inflight ??= build();
      cache = { at: Date.now(), data: await inflight };
      inflight = null;
    }
    return Response.json(
      { activity: cache.data },
      { headers: { "cache-control": "s-maxage=25, stale-while-revalidate=120" } }
    );
  } catch {
    inflight = null;
    // Activity is progressive enhancement; serve stale (or empty) over an error.
    return Response.json(
      { activity: cache?.data ?? [] },
      { headers: { "cache-control": "s-maxage=10" } }
    );
  }
}
