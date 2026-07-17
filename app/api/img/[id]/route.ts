import { NextRequest } from "next/server";

// Same-origin image proxy for Irys-hosted coin logos. The Irys gateway 302s to
// a third-party CDN domain that some ISPs and ad-blockers break; serving the
// bytes from our own origin makes logos load everywhere (same trick as /api/rpc).
export const runtime = "edge";

const ID_RE = /^[A-Za-z0-9_-]{20,64}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return new Response("bad id", { status: 400 });
  }
  const upstream = await fetch(`https://gateway.irys.xyz/${id}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!upstream || !upstream.ok) {
    return new Response("upstream error", { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  // Only ever proxy media/JSON, never HTML (keeps this from becoming an open proxy).
  if (!/^(image\/|application\/json)/.test(type)) {
    return new Response("unsupported type", { status: 415 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": type,
      // Irys content is immutable per id, cache hard at the edge and browser.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
