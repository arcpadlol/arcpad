# Citizen Security Review

**Target:** `CitizenLaunchpad` and `CitizenToken`
**Network:** Arc testnet (chain id 5042002)
**Deployed & verified:** [`0xeD4A537F0B933ac4fa6Bb8733889ef8a0d8FD955`](https://testnet.arcscan.app/address/0xeD4A537F0B933ac4fa6Bb8733889ef8a0d8FD955)
**Status:** Internal review complete, all findings resolved. No external third-party audit yet.

## Summary

Citizen's launchpad contracts underwent a full internal security review: a manual,
adversarial read of the curve arithmetic, fee accounting, graduation path,
buyback logic, and every owner power, alongside the Hardhat test suite. The
review found one critical, one medium, and two low-severity issues. All of them
were fixed and the fixes verified by the test suite (14 passing) before the
contract was redeployed and re-verified on Arcscan.

This document is a public summary. Citizen runs on Arc testnet only: tokens are
speculative test assets with no monetary value, and the contracts should not
hold real funds until an independent external audit is complete.

## Findings and resolutions

| # | Severity | Area | Status |
|---|----------|------|--------|
| C-1 | Critical | Graduation liquidity seeding | Resolved |
| M-1 | Medium | Buyback slippage | Resolved |
| L-1 | Low | Raise-target bounds | Resolved |
| L-2 | Low | Graduation-fee price continuity | Resolved |

### C-1 — Graduation liquidity seeding (Critical, resolved)

**Was:** graduation created the DEX pool only if one did not already exist and
skipped initialization if the pool was already priced. Because creating and
initializing a Uniswap-V3-style pool is permissionless, the pool could be seeded
at an arbitrary price before graduation, causing the launchpad to add its locked
liquidity at that manipulated price.

**Fix:** the launchpad now creates and initializes the graduation pool inside
`createCoin`, at the deterministic final curve price. The token address is not
known until it is deployed in that same call, so no one can create the pool
first, and initialization can only ever run once. Graduation also mints with
minimum-amount protection (at least 90% of each intended side), so a skewed
price reverts instead of depositing lopsided liquidity.

### M-1 — Buyback slippage (Medium, resolved)

**Was:** `executeBuyback` swapped through the pool with no minimum output, so the
buyback budget could be siphoned by sandwich MEV.

**Fix:** `executeBuyback` now takes a `minTokensBurned` floor and reverts if the
burn falls short.

### L-1 — Raise-target bounds (Low, resolved)

**Was:** an owner could allow a raise target small enough to truncate the virtual
reserve to zero.

**Fix:** `setRaiseTarget` enforces a minimum (`MIN_RAISE_TARGET`, 1 USDC).

### L-2 — Graduation-fee price continuity (Low, resolved)

**Was:** a graduation fee above ~3.57% would trim the LP's USDC side and open the
pool below the final curve price.

**Fix:** `setGraduationFeeBps` is capped at `MAX_GRADUATION_FEE_BPS` (3%), below
the continuity break-even, so the pool always opens at the exact final price.

## What the review confirmed is sound

- Sells and fee claims can never be paused, and there is no code path for the
  owner to withdraw user funds or touch the locked LP position.
- Fee-vault recipients are fixed at creation and cannot be redirected; all preset
  splits sum to exactly 100%, and curve rounding consistently favors the protocol
  over an over-withdrawal.
- Every state-changing entry point is reentrancy-guarded and follows
  checks-effects-interactions.

## Disclaimer

This is an internal, best-effort review by the Citizen team, not a formal audit by
an external security firm. The UNITFLOW (Uniswap V3 fork) infrastructure it builds
on was not reviewed and is assumed to behave like canonical Uniswap V3. Citizen is
testnet-only; obtain an independent external audit before any mainnet deployment
that holds real value.
