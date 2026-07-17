# ArcPad

Launch culture. Program value. The meme launchpad built natively on Arc.

Live at [www.arcpad.lol](https://www.arcpad.lol)

![ArcPad](docs/preview.png)

Every coin on ArcPad sells on a USDC bonding curve, routes its trading fees
through a programmable vault, and graduates into DEX liquidity that nobody can
pull. The contract enforces all of it.

## How it works

1. **Create.** Pick a name, ticker, fee vault preset and a graduation target.
   One transaction deploys the token and opens its curve.
2. **Trade.** 800M of the 1B supply sells on a constant-product curve
   denominated in USDC. Quotes, prices and progress come straight from the
   contract.
3. **Route.** 1% of every trade flows to the coin's vault preset (creator,
   bounties, treasury, agent, or buyback-and-burn), 0.5% to the platform.
   Recipients claim their USDC from the contract at any time.
4. **Graduate.** At the target, the remaining 200M tokens plus the raise become
   full-range UNITFLOW V3 liquidity at the same price, and the LP NFT locks in
   the contract forever.

## Contracts (Arc testnet, chain id 5042002)

| Contract | Address |
|---|---|
| ArcPadLaunchpad (verified) | [`0xdf155bA386ab42cBBD0EE043cf9f6bA17E7A3ac3`](https://testnet.arcscan.app/address/0xdf155bA386ab42cBBD0EE043cf9f6bA17E7A3ac3) |
| USDC (ERC-20 interface, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| UNITFLOW V3 factory (graduation venue) | `0xAb6A8AAb7d490007634ef59d424b5d89688a1971` |
| UNITFLOW position manager (locked LP) | `0x77c39eB310BE31e60068CE29855F83359bf85fc4` |

Every trade, fee split and graduation is a public transaction on Arc.

## Repository layout

- `app/` — Next.js frontend: landing, coin board with trending and cards/table
  views, create flow, activity feed, portfolio with on-chain fee claims, and a
  rate-limit-aware JSON-RPC proxy at `app/api/rpc`.
- `contracts/` — Hardhat workspace: `ArcPadLaunchpad` and `ArcPadToken`, deploy
  script with automatic Arcscan verification, and the test suite.

## Frontend

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Lint and build with `npm run lint` and
`npm run build`.

## Contracts

```bash
cd contracts
npm install
npx hardhat test
```

Deploying needs `ARC_RPC` and `PRIVATE_KEY` in `contracts/.env`. Never commit
that file.

## Disclaimer

ArcPad runs on Arc testnet and is not affiliated with Circle. Tokens are
speculative test assets with no monetary value. Contracts are unaudited; do not
use them to hold real value.
