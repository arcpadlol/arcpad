"use client";

// Permanent coin metadata on Irys (Arweave). Uploads under 100 KiB are free
// (Irys sponsors them) and need only a wallet signature, so storing a logo and
// description costs nothing. The Citizen contract has no metadata field, so
// uploads are tagged with the coin address and discovered via Irys GraphQL;
// authenticity comes from the upload being signed by the coin creator's own
// wallet (verified server-side in /api/meta against the contract state).
// Browser-only; the SDK is dynamic-imported so it never touches the server
// bundle.

import type { PublicClient, WalletClient } from "viem";
import { compressImage } from "./imgcompress";

const IRYS_GATEWAY = "https://gateway.irys.xyz";

/** Tag names shared with /api/meta. */
export const META_APP_TAG = "Citizen-Meta";

export type CoinMetaFields = {
  description?: string;
  website?: string;
  x?: string;
  telegram?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- SDK has no exported types for the builder */
let _uploader: Promise<any> | null = null;

async function getUploader(walletClient: WalletClient, publicClient: PublicClient) {
  if (_uploader) return _uploader;
  _uploader = (async () => {
    const { WebUploader } = await import("@irys/web-upload");
    const { WebBaseEth } = await import("@irys/web-upload-ethereum");
    const { ViemV2Adapter } = await import("@irys/web-upload-ethereum-viem-v2");
    // Route the uploader through our own origin: /tx, /price, ... are
    // rewritten to /api/irys/* (next.config.ts), so storing a logo works
    // even where the network blocks uploader.irys.xyz directly.
    return WebUploader(WebBaseEth)
      .withAdapter(ViemV2Adapter(walletClient as never, { publicClient: publicClient as never }))
      .bundlerUrl(window.location.origin);
  })();
  return _uploader;
}

export function resetIrys() {
  _uploader = null;
}

/** Upload logo (optional) + metadata JSON for a coin, signed by the connected
    wallet. Returns the metadata transaction id. Free under 100 KiB. */
export async function submitCoinMetadata(opts: {
  token: `0x${string}`;
  fields: CoinMetaFields;
  imageFile?: File | null;
  walletClient: WalletClient;
  publicClient: PublicClient;
}): Promise<string> {
  const { token, fields, imageFile, walletClient, publicClient } = opts;
  const irys = await getUploader(walletClient, publicClient);
  const tokenTag = token.toLowerCase();

  let image: string | undefined;
  if (imageFile) {
    const compressed = await compressImage(imageFile);
    const receipt = await irys.uploadFile(compressed, {
      tags: [
        { name: "Content-Type", value: compressed.type || "application/octet-stream" },
        { name: "App-Name", value: `${META_APP_TAG}-Image` },
        { name: "Arc-Token", value: tokenTag },
      ],
    });
    image = `${IRYS_GATEWAY}/${receipt.id}`;
  }

  const meta = {
    token: tokenTag,
    ...fields,
    ...(image ? { image } : {}),
  };
  const receipt = await irys.upload(JSON.stringify(meta), {
    tags: [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: META_APP_TAG },
      { name: "Arc-Token", value: tokenTag },
    ],
  });
  return receipt.id as string;
}
