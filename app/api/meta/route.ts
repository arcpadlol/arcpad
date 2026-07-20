import { decodeFunctionResult, encodeFunctionData } from "viem";
import { LAUNCHPAD, launchpadAbi } from "../../lib/arcpad";

// Coin metadata lookup. Metadata lives on Irys (Arweave), uploaded from the
// creator's own wallet and tagged with the coin address (app/lib/irys.ts).
// This route discovers uploads via Irys GraphQL, verifies that the upload was
// signed by the coin's on-chain creator, sanitizes the fields, and serves a
// token -> metadata map the frontend can consume in one request.

const GRAPHQL = "https://uploader.irys.xyz/graphql";
const GATEWAY = "https://gateway.irys.xyz";
const ARC_RPC = "https://rpc.testnet.arc.network";
// Uploads are tagged Citizen-Meta since the rebrand. Everything published
// before it carries the old tag, so the lookup accepts both and those coins
// keep their description and logo.
const APP_TAG = "Citizen-Meta";
const LEGACY_APP_TAG = "ArcPad-Meta";
const CACHE_MS = 60_000;

type Meta = {
  description?: string;
  website?: string;
  x?: string;
  telegram?: string;
  image?: string;
};

const jsonCache = new Map<string, Record<string, unknown> | null>(); // per immutable Irys id
let resultCache: { at: number; data: Record<string, Meta> } | null = null;
let inflight: Promise<Record<string, Meta>> | null = null;

/** POST to the Arc RPC, retrying its HTTP-200 "-32011 request limit reached"
    rate-limit responses with backoff (same trick as /api/rpc). */
async function arcCall(body: string): Promise<unknown> {
  let text = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
    const res = await fetch(ARC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    text = await res.text();
    if (res.ok && !text.includes('"code":-32011')) return JSON.parse(text);
  }
  throw new Error("Arc RPC unavailable");
}

/** Batch-read coins(token).creator for a set of tokens in one RPC round trip. */
async function readCreators(tokens: string[]): Promise<Record<string, string>> {
  if (tokens.length === 0) return {};
  const calls = tokens.map((t, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: "eth_call",
    params: [
      {
        to: LAUNCHPAD,
        data: encodeFunctionData({
          abi: launchpadAbi,
          functionName: "coins",
          args: [t as `0x${string}`],
        }),
      },
      "latest",
    ],
  }));
  const out = (await arcCall(JSON.stringify(calls))) as Array<{ id: number; result?: `0x${string}` }>;
  const creators: Record<string, string> = {};
  for (const r of Array.isArray(out) ? out : []) {
    if (!r?.result || r.result === "0x") continue;
    const decoded = decodeFunctionResult({
      abi: launchpadAbi,
      functionName: "coins",
      data: r.result,
    }) as readonly unknown[];
    creators[tokens[r.id]] = String(decoded[0]).toLowerCase();
  }
  return creators;
}

const cleanText = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

const cleanUrl = (v: unknown) => {
  const s = cleanText(v, 200);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
};

/** Only serve images that live on the Irys gateway, and through our proxy. */
const cleanImage = (v: unknown) => {
  if (typeof v !== "string") return undefined;
  const m = v.match(/^https:\/\/gateway\.irys\.xyz\/([A-Za-z0-9_-]{20,64})$/);
  return m ? `/api/img/${m[1]}` : undefined;
};

async function fetchMetaJson(id: string): Promise<Record<string, unknown> | null> {
  if (jsonCache.has(id)) return jsonCache.get(id) ?? null;
  try {
    const res = await fetch(`${GATEWAY}/${id}`, { signal: AbortSignal.timeout(8000) });
    const json = res.ok ? ((await res.json()) as Record<string, unknown>) : null;
    jsonCache.set(id, json);
    return json;
  } catch {
    return null; // transient; do not poison the immutable cache
  }
}

async function buildMetas(): Promise<Record<string, Meta>> {
  const query = `query {
    transactions(tags: [{ name: "App-Name", values: ["${APP_TAG}", "${LEGACY_APP_TAG}"] }], first: 100, order: DESC) {
      edges { node { id address tags { name value } } }
    }
  }`;
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Irys GraphQL ${res.status}`);
  const body = (await res.json()) as {
    data?: { transactions?: { edges?: Array<{ node: { id: string; address: string; tags: Array<{ name: string; value: string }> } }> } };
  };
  const edges = body.data?.transactions?.edges ?? [];

  // Newest upload wins per token; remember who signed it.
  const candidates = new Map<string, { id: string; owner: string }>();
  for (const { node } of edges) {
    const token = node.tags.find((t) => t.name === "Arc-Token")?.value?.toLowerCase();
    if (!token || !/^0x[0-9a-f]{40}$/.test(token) || candidates.has(token)) continue;
    candidates.set(token, { id: node.id, owner: node.address.toLowerCase() });
  }

  // Only accept metadata signed by the coin's on-chain creator.
  const creators = await readCreators([...candidates.keys()]);
  const metas: Record<string, Meta> = {};
  await Promise.all(
    [...candidates.entries()].map(async ([token, c]) => {
      if (creators[token] !== c.owner) return;
      const json = await fetchMetaJson(c.id);
      if (!json) return;
      const meta: Meta = {
        description: cleanText(json.description, 500),
        website: cleanUrl(json.website),
        x: cleanUrl(json.x),
        telegram: cleanUrl(json.telegram),
        image: cleanImage(json.image),
      };
      if (Object.values(meta).some(Boolean)) metas[token] = meta;
    })
  );
  return metas;
}

export async function GET() {
  try {
    if (!resultCache || Date.now() - resultCache.at > CACHE_MS) {
      inflight ??= buildMetas();
      resultCache = { at: Date.now(), data: await inflight };
      inflight = null;
    }
    return Response.json(
      { metas: resultCache.data },
      { headers: { "cache-control": "s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    inflight = null;
    // Serve stale data over an error; metadata is progressive enhancement.
    return Response.json(
      { metas: resultCache?.data ?? {} },
      { headers: { "cache-control": "s-maxage=30" } }
    );
  }
}
