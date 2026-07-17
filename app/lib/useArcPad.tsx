"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import {
  arcTestnet,
  publicClient,
  launchpadAbi,
  erc20Abi,
  LAUNCHPAD,
  type CoinInfo,
} from "./arcpad";

/** Deploy block of the launchpad; the activity endpoint reads logs from here. */
export const DEPLOY_BLOCK = 52_256_000n;

declare global {
  interface Window {
    ethereum?: any;
  }
}

// ---------------------------------------------------------------- wallet

export function useWallet() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const clientRef = useRef<WalletClient | null>(null);

  const refresh = useCallback(async () => {
    if (!window.ethereum) return;
    const [accounts, cid] = await Promise.all([
      window.ethereum.request({ method: "eth_accounts" }),
      window.ethereum.request({ method: "eth_chainId" }),
    ]);
    setAccount(accounts?.[0] ?? null);
    setChainId(parseInt(cid, 16));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async chain, no cascading render
    refresh();
    if (!window.ethereum?.on) return;
    window.ethereum.on("accountsChanged", refresh);
    window.ethereum.on("chainChanged", refresh);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", refresh);
      window.ethereum?.removeListener?.("chainChanged", refresh);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open("https://metamask.io/download/", "_blank");
      return null;
    }
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    await refresh();
    return (accounts?.[0] as `0x${string}`) ?? null;
  }, [refresh]);

  const ensureChain = useCallback(async () => {
    if (!window.ethereum) return false;
    const hex = "0x" + arcTestnet.id.toString(16);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hex }],
      });
    } catch (err: any) {
      if (err?.code !== 4902) throw err;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: "Arc Testnet",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: ["https://rpc.testnet.arc.network"],
            blockExplorerUrls: ["https://testnet.arcscan.app"],
          },
        ],
      });
    }
    await refresh();
    return true;
  }, [refresh]);

  const walletClient = useCallback(() => {
    if (!window.ethereum) return null;
    if (!clientRef.current) {
      clientRef.current = createWalletClient({
        chain: arcTestnet,
        transport: custom(window.ethereum),
      });
    }
    return clientRef.current;
  }, []);

  return {
    account,
    connected: !!account,
    onArc: chainId === arcTestnet.id,
    connect,
    ensureChain,
    walletClient,
  };
}

// ------------------------------------------------------------- coin data

export type ActivityItem = {
  kind: "buy" | "sell" | "create" | "graduate";
  token: `0x${string}`;
  symbol: string;
  usdc?: bigint;
  who: `0x${string}`;
  block: bigint;
  tx: `0x${string}`;
};

type RawAct = {
  kind: ActivityItem["kind"];
  token: string;
  usdc: string;
  who: string;
  block: number;
  tx: string;
};

export function useArcPadData() {
  const [coins, setCoins] = useState<CoinInfo[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Activity comes from the cached, server-side /api/activity endpoint. Reading
  // event logs straight from the browser hammered the Arc RPC's per-IP rate
  // limit (-32011) because every visitor shared the proxy's IP; one cached
  // server read serves everyone. Symbols are resolved from the coin list here.
  const loadActivity = useCallback(async (list: CoinInfo[]) => {
    const res = await fetch("/api/activity");
    const json = (await res.json()) as { activity?: RawAct[] };
    const symbolOf = Object.fromEntries(
      list.map((c) => [c.token.toLowerCase(), c.symbol])
    );
    const acts: ActivityItem[] = (json.activity ?? []).map((a) => ({
      kind: a.kind,
      token: a.token as `0x${string}`,
      symbol: symbolOf[a.token.toLowerCase()] ?? "?",
      usdc: a.usdc ? BigInt(a.usdc) : undefined,
      who: a.who as `0x${string}`,
      block: BigInt(a.block),
      tx: a.tx as `0x${string}`,
    }));
    setActivity(acts);
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);

      // Board comes from contract STATE, not logs, so it can never hit the
      // RPC's 10,000-block eth_getLogs range cap.
      const count = (await publicClient.readContract({
        address: LAUNCHPAD,
        abi: launchpadAbi,
        functionName: "coinCount",
      })) as bigint;
      const n = Number(count);

      const addrCalls = Array.from({ length: n }, (_, i) => ({
        address: LAUNCHPAD,
        abi: launchpadAbi,
        functionName: "allCoins",
        args: [BigInt(i)],
      }));
      const tokens = (
        n
          ? await publicClient.multicall({ contracts: addrCalls as any, allowFailure: false })
          : []
      ) as `0x${string}`[];

      const stateCalls = tokens.flatMap((t) => [
        { address: LAUNCHPAD, abi: launchpadAbi, functionName: "coins", args: [t] },
        { address: LAUNCHPAD, abi: launchpadAbi, functionName: "currentPrice", args: [t] },
        { address: LAUNCHPAD, abi: launchpadAbi, functionName: "curveProgressBps", args: [t] },
        { address: t, abi: erc20Abi, functionName: "name" },
        { address: t, abi: erc20Abi, functionName: "symbol" },
      ]);
      const results = stateCalls.length
        ? await publicClient.multicall({ contracts: stateCalls as any, allowFailure: false })
        : [];

      const list: CoinInfo[] = tokens.map((token, i) => {
        const s = results[i * 5] as any[];
        const virtualUsdc0 = s[6] as bigint;
        return {
          token,
          creator: s[0] as `0x${string}`,
          preset: Number(s[1]),
          graduated: s[2] as boolean,
          pool: s[12] as `0x${string}`,
          // raiseTarget derives from virtualUsdc0 = target * 7/20
          raiseTarget: (virtualUsdc0 * 20n) / 7n,
          realUsdc: s[9] as bigint,
          tokensSold: s[10] as bigint,
          buybackBudget: s[11] as bigint,
          price: results[i * 5 + 1] as bigint,
          progressBps: results[i * 5 + 2] as bigint,
          name: results[i * 5 + 3] as string,
          symbol: results[i * 5 + 4] as string,
        };
      });
      list.reverse(); // newest first
      setCoins(list);
      setLoading(false);

      // Activity is best effort: the public RPC rate-limits aggressively,
      // and a failed log read should never blank the board itself.
      try {
        // let the RPC rate-limit window refill after the board reads
        await new Promise((r) => setTimeout(r, 900));
        await loadActivity(list);
      } catch {
        // keep whatever activity we had
      }
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Failed to load on-chain data");
    } finally {
      setLoading(false);
    }
  }, [loadActivity]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async chain, no cascading render
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return { coins, activity, loading, error, reload: load };
}

// ------------------------------------------------------------ tx helpers

export type TxState =
  | { step: "idle" }
  | { step: "approving" | "confirming" | "pending"; label?: string }
  | { step: "done"; hash: `0x${string}` }
  | { step: "error"; message: string };

export function useTx(wallet: ReturnType<typeof useWallet>) {
  const [tx, setTx] = useState<TxState>({ step: "idle" });

  const run = useCallback(
    async (opts: {
      // ensure allowances for the launchpad before writing
      approvals?: Array<{ token: `0x${string}`; amount: bigint; unlimited?: bigint }>;
      write: () => Promise<`0x${string}`>;
    }) => {
      try {
        let account = wallet.account;
        if (!account) account = await wallet.connect();
        if (!account) throw new Error("Wallet not available");
        await wallet.ensureChain();
        const client = wallet.walletClient();
        if (!client) throw new Error("Wallet not available");

        for (const a of opts.approvals ?? []) {
          if (a.amount <= 0n) continue;
          const allowance = (await publicClient.readContract({
            address: a.token,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account, LAUNCHPAD],
          })) as bigint;
          if (allowance < a.amount) {
            setTx({ step: "approving" });
            const hash = await client.writeContract({
              address: a.token,
              abi: erc20Abi,
              functionName: "approve",
              args: [LAUNCHPAD, a.unlimited ?? a.amount],
              account,
              chain: arcTestnet,
            });
            await publicClient.waitForTransactionReceipt({ hash });
          }
        }

        setTx({ step: "confirming" });
        const hash = await opts.write();
        setTx({ step: "pending" });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Transaction reverted");
        setTx({ step: "done", hash });
        return receipt;
      } catch (e: any) {
        const msg =
          e?.code === 4001 || /rejected/i.test(e?.message ?? "")
            ? "Transaction rejected in wallet"
            : e?.shortMessage || e?.message || "Transaction failed";
        setTx({ step: "error", message: msg });
        return null;
      }
    },
    [wallet]
  );

  const reset = useCallback(() => setTx({ step: "idle" }), []);
  return { tx, run, reset };
}
