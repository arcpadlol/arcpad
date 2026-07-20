import { createPublicClient, defineChain, http } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11" as const,
    },
  },
});

export const LAUNCHPAD = "0xeD4A537F0B933ac4fa6Bb8733889ef8a0d8FD955" as const;
export const USDC = "0x3600000000000000000000000000000000000000" as const;
export const EXPLORER = "https://testnet.arcscan.app";
export const FAUCET = "https://faucet.circle.com";

/** Official links. Leave X_URL empty to hide the icon until the handle exists. */
export const X_URL = "https://x.com/Arcpad_";
export const GITHUB_URL = "https://github.com/arcpadlol/citizen";

/**
 * The product lives on its own subdomain so the marketing landing can keep its
 * heavy animated hero while the app stays light. The landing links across to
 * this host; every route below it is served by the same Next app.
 */
export const APP_URL = "https://app.citizenpad.lol";

export const PRESETS = [
  { key: 0, name: "Grow", split: "37.5% creator · 37.5% bounties · 25% treasury" },
  { key: 1, name: "Agent", split: "62.5% agent · 25% creator · 12.5% bounties" },
  { key: 2, name: "Burn", split: "62.5% buyback & burn · 25% creator · 12.5% treasury" },
  { key: 3, name: "Creator", split: "76.5% creator · 11.75% bounties · 11.75% treasury" },
] as const;

export const RAISE_TIERS = [3_000, 5_000, 10_000, 25_000] as const;

/** In the browser, read through /api/rpc so visitors whose network blocks
    the Arc RPC (CORS, ISP filtering) still get board data. */
export const publicClient = createPublicClient({
  chain: arcTestnet,
  // JSON-RPC batching + patient retries: the Arc public RPC rate-limits
  // bursts (429), so coalesce parallel calls into one HTTP request.
  transport: http(typeof window === "undefined" ? undefined : "/api/rpc", {
    batch: { wait: 32 },
    retryCount: 5,
    retryDelay: 500,
  }),
  batch: { multicall: true },
});

export const launchpadAbi = [
  {
    type: "function", name: "coinCount", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "allCoins", stateMutability: "view",
    inputs: [{ type: "uint256" }], outputs: [{ type: "address" }],
  },
  {
    type: "function", name: "coins", stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "preset", type: "uint8" },
      { name: "graduated", type: "bool" },
      { name: "bountyWallet", type: "address" },
      { name: "treasuryWallet", type: "address" },
      { name: "agentWallet", type: "address" },
      { name: "virtualUsdc0", type: "uint128" },
      { name: "virtualUsdc", type: "uint128" },
      { name: "virtualToken", type: "uint128" },
      { name: "realUsdc", type: "uint128" },
      { name: "tokensSold", type: "uint128" },
      { name: "buybackBudget", type: "uint128" },
      { name: "pool", type: "address" },
      { name: "lpTokenId", type: "uint256" },
    ],
  },
  {
    type: "function", name: "quoteBuy", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ name: "tokensOut", type: "uint256" }, { name: "usdcSpent", type: "uint256" }],
  },
  {
    type: "function", name: "quoteSell", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ name: "usdcOut", type: "uint256" }],
  },
  {
    type: "function", name: "currentPrice", stateMutability: "view",
    inputs: [{ type: "address" }], outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "curveProgressBps", stateMutability: "view",
    inputs: [{ type: "address" }], outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "claimableFees", stateMutability: "view",
    inputs: [{ type: "address" }], outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "createCoin", stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "preset", type: "uint8" },
      { name: "raiseTarget", type: "uint256" },
      { name: "bountyWallet", type: "address" },
      { name: "treasuryWallet", type: "address" },
      { name: "agentWallet", type: "address" },
    ],
    outputs: [{ type: "address" }],
  },
  {
    type: "function", name: "buy", stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "usdcIn", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "sell", stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokensIn", type: "uint256" },
      { name: "minUsdcOut", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "claimFees", stateMutability: "nonpayable",
    inputs: [], outputs: [{ type: "uint256" }],
  },
  {
    type: "event", name: "CoinCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "preset", type: "uint8", indexed: false },
      { name: "raiseTarget", type: "uint256", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
    ],
  },
  {
    type: "event", name: "Trade",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "isBuy", type: "bool", indexed: true },
      { name: "usdcAmount", type: "uint256", indexed: false },
      { name: "tokenAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Graduated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "pool", type: "address", indexed: false },
      { name: "lpTokenId", type: "uint256", indexed: false },
      { name: "tokensToLp", type: "uint256", indexed: false },
      { name: "usdcToLp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ type: "address" }], outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "name", stateMutability: "view",
    inputs: [], outputs: [{ type: "string" }],
  },
  {
    type: "function", name: "symbol", stateMutability: "view",
    inputs: [], outputs: [{ type: "string" }],
  },
] as const;

export type CoinInfo = {
  token: `0x${string}`;
  name: string;
  symbol: string;
  creator: `0x${string}`;
  preset: number;
  graduated: boolean;
  pool: `0x${string}`;
  raiseTarget: bigint; // 6d
  realUsdc: bigint; // 6d
  tokensSold: bigint; // 18d
  price: bigint; // USDC 6d per whole token
  progressBps: bigint;
  buybackBudget: bigint;
};

export const fmtUsd = (v6: bigint | number, digits = 2) => {
  const n = typeof v6 === "bigint" ? Number(v6) / 1e6 : v6;
  if (n >= 1000)
    return `$${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;
  return `$${n.toLocaleString("en", { maximumFractionDigits: digits })}`;
};

export const fmtToken = (v18: bigint, digits = 2) => {
  const n = Number(v18) / 1e18;
  return Intl.NumberFormat("en", {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(n);
};

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

export const fmtPrice = (v6: bigint) => {
  const n = Number(v6) / 1e6;
  if (n === 0) return "$0";
  if (n >= 1) return `$${n.toLocaleString("en", { maximumFractionDigits: 2 })}`;
  if (n >= 0.0001) return `$${n.toLocaleString("en", { maximumFractionDigits: 6 })}`;
  // Sub-0.0001 prices use subscript-zero notation, e.g. $0.0₄1398,
  // instead of unreadable scientific form like $1.40e-5.
  const [mant, exp] = n.toExponential(3).split("e");
  const zeros = -parseInt(exp) - 1;
  const digits = mant.replace(".", "").replace(/0+$/, "");
  const sub = String(zeros).split("").map((d) => SUBSCRIPTS[Number(d)]).join("");
  return `$0.0${sub}${digits}`;
};

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Market cap in 6d USDC units: price * 1B supply. */
export const marketCap = (price6: bigint) => price6 * 1_000_000_000n;
