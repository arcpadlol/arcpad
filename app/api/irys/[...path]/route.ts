import { NextRequest } from "next/server";

// Same-origin proxy for the Irys uploader, so storing a coin logo works even
// on networks that block uploader.irys.xyz (same trick as /api/rpc and
// /api/img). Only the SDK's data paths are forwarded; uploads are capped so
// this can't be abused as a generic relay.
export const runtime = "edge";

const UPSTREAM = "https://uploader.irys.xyz";
const ALLOWED = /^(tx|price|account|info|chunks|graphql)(\/|$)/;
const MAX_BODY = 1_500_000; // bytes; logos are compressed to <100 KB

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const joined = path.join("/");
  if (!ALLOWED.test(joined)) {
    return new Response("not found", { status: 404 });
  }

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
    if (body.byteLength > MAX_BODY) {
      return new Response("payload too large", { status: 413 });
    }
  }

  const upstream = await fetch(`${UPSTREAM}/${joined}${req.nextUrl.search}`, {
    method: req.method,
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/octet-stream",
      accept: req.headers.get("accept") ?? "*/*",
    },
    body,
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);

  if (!upstream) return new Response("upstream error", { status: 502 });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    },
  });
}

export { handler as GET, handler as POST, handler as HEAD };
