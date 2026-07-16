const ARC_RPC = "https://rpc.testnet.arc.network";

/** The Arc public RPC rate-limits per call, answering HTTP 200 with
    {"code":-32011,"message":"request limit reached"}. HTTP-level retries
    never see it, so retry here, server-side, with backoff. */
const isRateLimited = (text: string) => text.includes('"code":-32011');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thin JSON-RPC proxy so browser reads never depend on the visitor's
    network being able to reach the Arc RPC directly (CORS, ISP blocks).
    Reads only — wallets submit transactions through their own provider. */
export async function POST(req: Request) {
  const body = await req.text();

  let text = "";
  let status = 502;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await sleep(400 * 2 ** (attempt - 1));
    const upstream = await fetch(ARC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    text = await upstream.text();
    status = upstream.status;
    if (upstream.ok && !isRateLimited(text)) break;
  }

  return new Response(text, {
    status,
    headers: { "content-type": "application/json" },
  });
}
