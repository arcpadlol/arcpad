# Citizen Contracts

Bonding-curve launchpad contracts for Arc testnet (chain 5042002). USDC-native, with programmable fee vaults and automatic graduation to UNITFLOW (Uniswap V3 compatible) liquidity.

## Live deployment (Arc testnet)

- CitizenLaunchpad: [`0xeD4A537F0B933ac4fa6Bb8733889ef8a0d8FD955`](https://testnet.arcscan.app/address/0xeD4A537F0B933ac4fa6Bb8733889ef8a0d8FD955) (verified, 2026-07-21)
- Smoke-tested end to end on-chain: create, curve buy, graduation into a real UNITFLOW pool with locked LP, post-graduation buyback-and-burn through the pool, fee claims.
- Note: UNITFLOW pools use `unitFlowV3SwapCallback` instead of the standard Uniswap callback name; the launchpad implements both.

## Contracts

- `CitizenToken.sol` — fixed-supply 1,000,000,000 token (18 decimals), fully minted to the launchpad, burnable, no owner.
- `CitizenLaunchpad.sol` — creation, bonding curve, fee vaults, buybacks, graduation, locked LP, LP fee harvesting.

## Economics

- Curve sells 800,000,000 tokens; 200,000,000 are reserved for DEX liquidity.
- The creator picks a graduation raise target: 3k, 5k, 10k, or 25k USDC (owner can add tiers).
- Trade fee 1.5%: 1.0% to the coin's vault preset, 0.5% to the platform. Editable by the owner up to a hard cap of 5% total.
- Vault presets (share of the 1% vault fee): Grow 37.5/37.5/25 creator/bounties/treasury, Agent 62.5 agent + 25 creator + 12.5 bounties, Burn 62.5 buyback + 25 creator + 12.5 treasury, Creator 76.5 creator + 11.75 bounties + 11.75 treasury.
- Graduation: 3% of the raise to the platform, the rest plus 200M tokens becomes full-range V3 liquidity at the final curve price. The LP NFT is locked in the launchpad forever; anyone can harvest its fees, which flow through the same vault preset (token side is burned).
- Burn preset budgets are executed by anyone via `executeBuyback`: on the curve before graduation, through the V3 pool after.

## Arc specifics

- USDC is the gas token. Contracts only use the ERC-20 interface at `0x3600000000000000000000000000000000000000` (6 decimals); no native value is handled.
- UNITFLOW V3 on Arc testnet (bytecode verified on-chain 2026-07-16): factory `0xAb6A8AAb7d490007634ef59d424b5d89688a1971`, position manager `0x77c39eB310BE31e60068CE29855F83359bf85fc4`.
- Uniswap v4 is not deployed on Arc testnet yet; graduation targets V3 and is isolated in `_graduate` for an easy swap later.

## Develop

```bash
npm install
npm test
```

## Deploy and verify

Create `contracts/.env` (the repo gitignores all `.env*` files) with:

```
PRIVATE_KEY=        # testnet-only key, fund it via faucet.circle.com (Arc Testnet)
ARC_RPC=https://rpc.testnet.arc.network
PROTOCOL_TREASURY=  # optional, defaults to the deployer
```

Then:

```bash
npm run deploy:arc   # deploys and auto-verifies on https://testnet.arcscan.app
```

Never commit `.env` or private keys.

## Known limitations (testnet MVP)

- Pool frontrun edge: someone could initialize the V3 pool at a skewed price before graduation; the mint then takes a skewed ratio. Acceptable on testnet, revisit before mainnet.
- Tokens are freely transferable before graduation, so side markets are possible.
- Contracts are unaudited. Do not use with real value.
