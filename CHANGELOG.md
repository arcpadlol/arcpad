# ArcPad Changelog

Newest entries first. Record only work that actually landed.

## 2026-07-17 — Contract security fixes and Arc testnet redeploy

### Fixed

- C-1 (critical): the graduation pool is now created and initialized inside `createCoin` at the deterministic final curve price, so it cannot be pre-seeded at a bogus price; graduation also mints with 90%-per-side minimum-amount protection.
- M-1 (medium): `executeBuyback` takes a `minTokensBurned` slippage floor.
- L-1 (low): `setRaiseTarget` enforces `MIN_RAISE_TARGET` (1 USDC).
- L-2 (low): `setGraduationFeeBps` capped at `MAX_GRADUATION_FEE_BPS` (3%) so the pool always opens at the exact final price.

### Changed

- Redeployed and re-verified the launchpad on Arc testnet at `0xdf155bA386ab42cBBD0EE043cf9f6bA17E7A3ac3`; frontend `LAUNCHPAD` and `DEPLOY_BLOCK` updated.

### Validation

- `npx hardhat test`: 14 passing (added coverage for the pre-created graduation pool and the new fee/raise-target bounds).

## 2026-07-17 — Premium redesign, full app navigation, resilient RPC reads

### Added

- Primehod-style navigation: persistent topbar with active-link underline, live "Arc Testnet" chain pill, wallet connect control, mobile hamburger menu, X/GitHub social slots.
- `/activity` page: full on-chain event feed (creates, buys, sells, graduations).
- `/portfolio` page: wallet holdings with estimated curve value, claimable vault fees with one-click on-chain claim, trade from the list.
- Board: trending rail (top tokens by USDC volume in the recent window, exempt from the feed cap), Cards/Table view toggle with a horizontally scrollable table on mobile, 20-newest feed cap on the Newest tab.
- `/api/rpc` JSON-RPC proxy on Vercel: bypasses browser CORS and visitor ISP blocks, retries the Arc RPC's HTTP-200 `-32011 request limit reached` responses with exponential backoff.

### Changed

- Full visual redesign to a light premium system: paper background, near-black navy ink, Arc blue from the brand mark, gold reserved for primary actions; pill buttons, 20px card radius, soft shadows; centered hero with stat tiles and a featured market card.
- All icons are inline custom SVGs; emoji and typographic glyph icons removed site-wide.
- viem transport now batches JSON-RPC calls (`batch.wait`) with patient retries; activity log reads are best effort and no longer blank the board on failure.
- Canonical domain set to https://www.arcpad.lol in metadata.

### Validation

- `npm run lint` and `npm run build` clean; all routes prerender.
- Deployed to production; desktop and 390px mobile screenshots of `/`, `/app`, `/create`, `/activity`, `/portfolio` verified with zero horizontal overflow.

## 2026-07-16 — Live frontend: Arc-brand light UI + on-chain integration

### Added

- Landing page (`/`) for branding: animated bonding-curve hero with live on-chain stats, four-step flow, vault preset split bars, contract address table, FAQ, CTA band.
- App (`/app`) for deploying and trading: coin board read from chain (CoinCreated events + multicall state), on-chain activity feed, search and tabs, trade modal with live quotes and slippage guard, `/create` opens the launch form directly.
- Wallet integration via viem: injected wallet connect, automatic Arc Testnet add/switch, USDC and token approvals, tx state feedback with Arcscan links.

### Changed

- Full redesign from dark mock UI to the official Arc brand language: light surfaces, Protocol Navy, Validator Blue, Sky Sync tints, gold accents, DM Sans + Space Grotesk + Space Mono (self-hosted).
- All demo/mock data removed; every number on the site now comes from the live contract.

### Validation

- `npm run lint` and `npm run build` clean; `/`, `/app`, `/create` prerender statically and verified serving correct content.
- Root project deployed directly to Vercel (replaces the `vercel-static` bridge). Note: deployments from this repo must be authored by a team member; commit identity is set to `arcpadlol` repo-locally.

## 2026-07-16 — Launchpad smart contracts (Arc testnet)

### Added

- `contracts/` hardhat workspace with `ArcPadToken` and `ArcPadLaunchpad`: USDC bonding curve (constant product, virtual reserves), creator-selected raise targets (3k/5k/10k/25k USDC), 1.5% trade fee split 1% vault preset + 0.5% platform, buyback-and-burn, graduation to a locked full-range UNITFLOW V3 position at curve-continuous price, LP fee harvesting through the vault presets, pause, pull-based fee claims.
- Deploy script with automatic Arcscan (Blockscout) verification; test suite (12 cases) covering curve math, fee routing, graduation, buybacks, and admin controls.

### Validation

- `npx hardhat test`: 12 passing on 2026-07-16.
- UNITFLOW V3 and USDC ERC-20 interface addresses verified against live Arc testnet bytecode via RPC.
- Deployed and verified on Arc testnet at `0x8eA715A26fCa0c474c81D65142439b306c1Be131`; full on-chain smoke test passed (create, buy, graduation into a live UNITFLOW pool, post-graduation buyback, fee claim). Two fork quirks fixed along the way: sqrt-price overflow on tiny raise tiers and UNITFLOW's renamed `unitFlowV3SwapCallback`.

## 2026-07-16 — Team collaboration baseline

### Added

- Contributor workflow, pull request template, deployment guide, specification, project memory, and agent maintenance rules.
- GitHub `main` and `develop` branches and Vercel repository connection.
- Repository ownership moved to the ArcPad team account at `arcpadlol/arcpad-web`.

### Changed

- Replaced the starter README with ArcPad-specific local setup and collaboration guidance.
- Replaced the vinext runtime scripts with standard Next.js and local Geist fonts for direct GitHub deployment.

## 2026-07-16 — ArcPad MVP

### Added

- Arc-themed meme launchpad board, demo coin creation, demo trading modal, market activity, programmable vault positioning, responsive design, and social preview.

### Changed

- Increased typography and interface scale for desktop and mobile readability.

### Validation

- Production deployed and returned HTTP 200 at https://arcpad-lol.vercel.app.
