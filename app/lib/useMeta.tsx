"use client";

import { useCallback, useEffect, useState } from "react";

export type CoinMeta = {
  description?: string;
  website?: string;
  x?: string;
  telegram?: string;
  image?: string;
};

export type MetaMap = Record<string, CoinMeta>;

/** Coin metadata map (token address, lowercase -> meta) from /api/meta. */
export function useMeta() {
  const [metas, setMetas] = useState<MetaMap>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/meta");
      const json = (await res.json()) as { metas?: MetaMap };
      setMetas(json.metas ?? {});
    } catch {
      // metadata is progressive enhancement; keep whatever we had
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async chain, no cascading render
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { metas, refreshMetas: refresh };
}
