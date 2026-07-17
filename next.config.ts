import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Irys upload SDK resolves its endpoints as absolute paths (/tx, /price,
  // ...), so when we point it at our own origin (see app/lib/irys.ts) these
  // rewrites hand the calls to the same-origin proxy. That keeps logo uploads
  // working on networks that block uploader.irys.xyz directly.
  async rewrites() {
    const irys = ["tx", "price", "account", "info", "chunks", "graphql"];
    return irys.map((p) => ({
      source: `/${p}/:path*`,
      destination: `/api/irys/${p}/:path*`,
    }));
  },
};

export default nextConfig;
