# Citizen — Product & Technical Specification

**Owner:** Citizen team  
**Status:** Draft  
**Version:** 0.1  
**Last updated:** 2026-07-16

## Executive summary

Citizen is an Arc-native meme-token launchpad concept where USDC trading fees can fund programmable creator, bounty, buyback, burn, treasury, or agent vaults. The current deployed release validates positioning and interaction design; it does not execute blockchain transactions.

## Problem and opportunity

Most meme launchpads optimize token creation and speculation but give projects limited control over recurring fee flows. Citizen explores whether programmable, visible USDC fee routing can make meme economies more durable and legible.

## Target users

| User | Need | Success signal |
|---|---|---|
| Meme creator | Launch a token with minimal friction | Coin page and market become available quickly |
| Trader | Discover and trade new tokens transparently | Price, curve, liquidity, fees, and risks are understandable |
| Community operator | Fund growth without manual accounting | Vault routing is visible and auditable |

## Product principles

- Meme-native, fast, and legible.
- USDC-denominated economics.
- Programmable fee flows are visible before trading.
- No misleading claims about safety, returns, or decentralization.

## Scope

### MVP

- Coin discovery board and activity feed.
- Coin creation and trade interaction prototypes.
- Vault presets for creator, growth, agent, burn, and treasury flows.
- Responsive public web experience.

### Later

- Arc wallet integration, contracts, indexer, DEX graduation, moderation, analytics, and audited treasury controls.

### Non-goals

- Guaranteed returns, anonymous production deployment, or unaudited custody.
- Supporting chains other than Arc during the initial validation phase.

## User journeys

1. A creator configures a coin, ticker, story, and fee vault.
2. The interface previews fees and deployment implications.
3. After an explicit wallet confirmation, the contract creates the market.
4. Traders inspect economics and submit USDC trades.
5. A qualifying market graduates to a supported DEX.

Failure journeys must explain wallet rejection, insufficient funds, failed transactions, stale quotes, unsupported networks, and contract pauses without implying success.

## Functional requirements

| ID | Requirement | Priority | Acceptance signal |
|---|---|---|---|
| FR-001 | Users can discover coins using market and social signals | Must | Board exposes searchable, readable market cards |
| FR-002 | Creators can configure a coin and fee-routing preset | Must | Preview clearly shows every allocation |
| FR-003 | Traders can review quote, fees, slippage, and vault flow before signing | Must | No transaction starts before explicit confirmation |
| FR-004 | Markets can expose bonding-curve and graduation progress | Must | UI state matches indexed onchain state |
| FR-005 | Operators can pause unsafe launch or trade paths | Later | Authorized pause is observable and tested |

## Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-001 | Responsive UI | Usable from 360px mobile width through desktop |
| NFR-002 | Accessibility | Keyboard navigation, visible focus, semantic controls |
| NFR-003 | Performance | Core public route remains lightweight and cacheable |
| NFR-004 | Security | Contracts reviewed, tested, and audited before real value |

## Domain model

| Term | Definition | Source of truth |
|---|---|---|
| Coin | Meme token and its launch configuration | Contract/indexer once implemented |
| Market | Curve or DEX venue used to trade a coin | Contract and DEX |
| Vault | Rule-bound destination for a share of trading fees | Contract |
| Graduation | Transition from launch curve to DEX liquidity | Contract state machine |

## Architecture

Current: React/Next-compatible frontend running through vinext, with a temporary static Vercel mirror. Planned: web client, wallet layer, Arc contracts, indexer/API, moderation service, and analytics. Contracts—not UI state—must own token creation, accounting, routing, and graduation rules.

## Security, privacy, compliance, and abuse

- Contracts require unit, fuzz, invariant, testnet, and independent audit coverage before real assets.
- Fee allocation totals must equal the distributable fee and never exceed collected value.
- Admin, pause, upgrade, multisig, and timelock powers must be documented in the UI.
- Launches require anti-spam and abuse controls; content and token risks require legal review.
- No private key, seed phrase, credential, or unnecessary personal data may be collected.

## Observability

Track coin creation funnel, wallet errors, trade quote failures, signed transactions, graduation, vault distributions, and client performance without storing wallet secrets.

## Launch gates

- [ ] Product and economic specification approved.
- [ ] Arc testnet contracts implemented and invariant-tested.
- [ ] Indexer reconciles against onchain accounting.
- [ ] Independent security and legal reviews completed.
- [ ] Monitoring, pause runbook, and incident ownership defined.

## Assumptions and open decisions

- Arc network and USDC primitives remain suitable dependencies.
- [ ] Select bonding-curve model and graduation DEX.
- [ ] Define immutable versus upgradeable contract boundaries.
- [ ] Approve fee percentages, admin controls, and moderation policy.
