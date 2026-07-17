// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ArcPadToken} from "./ArcPadToken.sol";
import {IUniswapV3Factory, IUniswapV3Pool, INonfungiblePositionManager} from "./interfaces/IUniswapV3.sol";

/// @title ArcPadLaunchpad
/// @notice USDC-native bonding-curve launchpad for Arc with programmable fee vaults.
///
///         Economics
///         - Every coin has 1,000,000,000 tokens (18 decimals).
///         - 800,000,000 are sold on a constant-product curve with virtual
///           reserves. The creator picks a graduation raise target (default
///           tiers 3k / 5k / 10k / 25k USDC); the initial virtual USDC
///           reserve is target * 7/20 against 1,080,000,000 virtual tokens,
///           which makes the curve sell out exactly at the target.
///         - Trades pay 1.5% in USDC: 1.0% routed to the coin's vault preset,
///           0.5% to the platform.
///         - At graduation the remaining 200,000,000 tokens plus the raised
///           USDC (minus a 3% graduation fee) are added as full-range
///           liquidity to a UNITFLOW (Uniswap V3 compatible) 1% pool at the
///           exact final curve price. The LP NFT stays locked in this
///           contract forever; its trading fees can be harvested by anyone
///           and are routed through the same vault preset.
///         - The Burn preset accrues a buyback budget that anyone can execute:
///           bought tokens are burned, on the curve before graduation and
///           through the V3 pool after.
///
///         Arc specifics: USDC is used strictly through its ERC-20 interface
///         (0x3600...0000, 6 decimals). No native value is ever handled.
contract ArcPadLaunchpad is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- types

    enum Preset {
        Grow, // creator 37.5% / bounties 37.5% / treasury 25%
        Agent, // agent 62.5% / creator 25% / bounties 12.5%
        Burn, // buyback 62.5% / creator 25% / treasury 12.5%
        Creator // creator 76.5% / bounties 11.75% / treasury 11.75%
    }

    struct Coin {
        address creator;
        Preset preset;
        bool graduated;
        address bountyWallet;
        address treasuryWallet;
        address agentWallet;
        uint128 virtualUsdc0; // initial virtual USDC, set by the raise target
        uint128 virtualUsdc; // 6 decimals
        uint128 virtualToken; // 18 decimals
        uint128 realUsdc; // USDC held for the curve (fees excluded)
        uint128 tokensSold;
        uint128 buybackBudget; // USDC reserved for buyback-and-burn
        address pool;
        uint256 lpTokenId;
    }

    // ------------------------------------------------------------ constants

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 public constant CURVE_SUPPLY = 800_000_000e18;
    uint128 public constant VIRTUAL_TOKEN_0 = 1_080_000_000e18;
    /// @dev raise = virtualUsdc0 * CURVE_SUPPLY / (VIRTUAL_TOKEN_0 - CURVE_SUPPLY),
    ///      so virtualUsdc0 = raiseTarget * 7 / 20 with the constants above.
    uint256 private constant RAISE_TO_VIRTUAL_NUM = 7;
    uint256 private constant RAISE_TO_VIRTUAL_DEN = 20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_TOTAL_FEE_BPS = 500; // hard cap 5%
    /// @dev Graduation fee is capped below the price-continuity break-even
    ///      (~3.57%) so the pool is always seeded at the exact final curve
    ///      price and never opens at a discount.
    uint256 public constant MAX_GRADUATION_FEE_BPS = 300; // 3%
    /// @dev Smallest raise target allowed, well above the point where the
    ///      virtual reserve would truncate to zero.
    uint256 public constant MIN_RAISE_TARGET = 1e6; // 1 USDC
    /// @dev Graduation mint must consume at least this share of each intended
    ///      side, so a pool whose price was skewed cannot force a lopsided,
    ///      lootable deposit; a mispriced mint reverts instead.
    uint256 private constant MINT_MIN_BPS = 9000; // 90%

    uint24 public constant POOL_FEE = 10_000; // 1% V3 fee tier (tick spacing 200)
    int24 private constant MIN_TICK = -887_200;
    int24 private constant MAX_TICK = 887_200;
    uint160 private constant MIN_SQRT_RATIO = 4_295_128_739;
    uint160 private constant MAX_SQRT_RATIO =
        1461446703485210103287273052203988822378723970342;

    // ----------------------------------------------------------- immutables

    IERC20 public immutable usdc;
    IUniswapV3Factory public immutable v3Factory;
    INonfungiblePositionManager public immutable positionManager;

    // -------------------------------------------------------------- storage

    /// @notice Trade fee routed to the coin's vault preset. Default 1.0%.
    uint256 public vaultFeeBps = 100;
    /// @notice Trade fee kept by the platform. Default 0.5%.
    uint256 public platformFeeBps = 50;
    /// @notice Flat USDC fee to create a coin. Default 0.01 USDC.
    uint256 public creationFee = 10_000;
    /// @notice Share of the raise taken at graduation. Default 3%.
    ///         Capped at 5%; anything above ~3.5% only trims the LP side.
    uint256 public graduationFeeBps = 300;

    /// @notice Raise targets (in USDC, 6 decimals) creators may choose from.
    mapping(uint256 => bool) public allowedRaiseTargets;

    address public protocolTreasury;

    mapping(address token => Coin) public coins;
    address[] public allCoins;

    /// @notice USDC fees claimable per recipient (pull pattern).
    mapping(address account => uint256) public claimableFees;

    // --------------------------------------------------------------- events

    event CoinCreated(
        address indexed token,
        address indexed creator,
        Preset preset,
        uint256 raiseTarget,
        string name,
        string symbol
    );
    event RaiseTargetSet(uint256 raiseTarget, bool allowed);
    event Trade(
        address indexed token,
        address indexed trader,
        bool indexed isBuy,
        uint256 usdcAmount,
        uint256 tokenAmount
    );
    event FeesClaimed(address indexed account, uint256 amount);
    event Buyback(address indexed token, uint256 usdcIn, uint256 tokensBurned);
    event Graduated(
        address indexed token,
        address pool,
        uint256 lpTokenId,
        uint256 tokensToLp,
        uint256 usdcToLp
    );
    event PoolFeesCollected(
        address indexed token,
        uint256 usdcAmount,
        uint256 tokensBurned
    );
    event FeesUpdated(uint256 vaultFeeBps, uint256 platformFeeBps);
    event ProtocolTreasuryUpdated(address treasury);

    // --------------------------------------------------------------- errors

    error UnknownCoin();
    error AlreadyGraduated();
    error ZeroAmount();
    error SlippageExceeded();
    error FeeTooHigh();
    error ZeroAddress();
    error NotPool();
    error BudgetExceeded();
    error InvalidRaiseTarget();

    // ---------------------------------------------------------- constructor

    constructor(
        IERC20 usdc_,
        IUniswapV3Factory v3Factory_,
        INonfungiblePositionManager positionManager_,
        address protocolTreasury_,
        address owner_
    ) Ownable(owner_) {
        if (protocolTreasury_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        v3Factory = v3Factory_;
        positionManager = positionManager_;
        protocolTreasury = protocolTreasury_;

        // Default graduation tiers creators can pick from.
        allowedRaiseTargets[3_000e6] = true;
        allowedRaiseTargets[5_000e6] = true;
        allowedRaiseTargets[10_000e6] = true;
        allowedRaiseTargets[25_000e6] = true;
    }

    /// @dev Per-coin constant-product invariant.
    function _k(Coin storage c) private view returns (uint256) {
        return uint256(c.virtualUsdc0) * VIRTUAL_TOKEN_0;
    }

    /// @dev The graduation pool's token ordering and sqrt price are fully
    ///      determined by the raise target: at sell-out the virtual reserves
    ///      are fixed, so the final price is known already at creation. Used
    ///      to pre-create and initialize the pool in `createCoin`, and again
    ///      as a defensive fallback in `_graduate`.
    function _gradPlan(
        address token,
        uint256 virtualUsdc0_
    ) private view returns (address t0, address t1, uint160 sqrtPriceX96) {
        uint256 tokensToLp = TOTAL_SUPPLY - CURVE_SUPPLY;
        uint256 vTend = VIRTUAL_TOKEN_0 - CURVE_SUPPLY;
        // Matches the curve's exact final virtualUsdc (ceilDiv of k / vTend).
        uint256 vUend = Math.ceilDiv(virtualUsdc0_ * VIRTUAL_TOKEN_0, vTend);
        uint256 usdcToLp = Math.mulDiv(tokensToLp, vUend, vTend);

        (t0, t1) = address(usdc) < token
            ? (address(usdc), token)
            : (token, address(usdc));
        (uint256 a0, uint256 a1) = t0 == address(usdc)
            ? (usdcToLp, tokensToLp)
            : (tokensToLp, usdcToLp);
        // sqrt(a1/a0) in Q64.96, computed at 2^96 scale then shifted so
        // extreme USDC-vs-1e18-token ratios cannot overflow the mulDiv.
        sqrtPriceX96 = uint160(Math.sqrt(Math.mulDiv(a1, 1 << 96, a0)) << 48);
    }

    // ------------------------------------------------------------- creation

    /// @notice Deploy a new coin and open its bonding curve.
    /// @param raiseTarget USDC (6 decimals) to raise before graduation; must
    ///        be one of the allowed tiers (default 3k / 5k / 10k / 25k).
    /// @param bountyWallet Recipient of the bounty share (creator if zero).
    /// @param treasuryWallet Recipient of the coin-treasury share (creator if zero).
    /// @param agentWallet Recipient of the agent share (creator if zero).
    function createCoin(
        string calldata name,
        string calldata symbol,
        Preset preset,
        uint256 raiseTarget,
        address bountyWallet,
        address treasuryWallet,
        address agentWallet
    ) external nonReentrant whenNotPaused returns (address token) {
        if (!allowedRaiseTargets[raiseTarget]) revert InvalidRaiseTarget();
        if (creationFee > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), creationFee);
            claimableFees[protocolTreasury] += creationFee;
        }

        token = address(new ArcPadToken(name, symbol, TOTAL_SUPPLY));

        uint128 virtualUsdc0 = uint128(
            (raiseTarget * RAISE_TO_VIRTUAL_NUM) / RAISE_TO_VIRTUAL_DEN
        );

        Coin storage c = coins[token];
        c.creator = msg.sender;
        c.preset = preset;
        c.bountyWallet = bountyWallet == address(0) ? msg.sender : bountyWallet;
        c.treasuryWallet = treasuryWallet == address(0) ? msg.sender : treasuryWallet;
        c.agentWallet = agentWallet == address(0) ? msg.sender : agentWallet;
        c.virtualUsdc0 = virtualUsdc0;
        c.virtualUsdc = virtualUsdc0;
        c.virtualToken = VIRTUAL_TOKEN_0;

        // Create and initialize the graduation pool now, at the deterministic
        // final curve price. The token was just deployed, so its address is
        // unknowable until this call and no one can have pre-created the pool.
        // Owning the pool's initialization is what stops an attacker from
        // seeding it at a bogus price and looting the locked liquidity.
        (address gt0, address gt1, uint160 gSqrt) = _gradPlan(token, virtualUsdc0);
        address gpool = v3Factory.getPool(gt0, gt1, POOL_FEE);
        if (gpool == address(0)) gpool = v3Factory.createPool(gt0, gt1, POOL_FEE);
        (uint160 gCur, , , , , , ) = IUniswapV3Pool(gpool).slot0();
        if (gCur == 0) IUniswapV3Pool(gpool).initialize(gSqrt);
        c.pool = gpool;

        allCoins.push(token);
        emit CoinCreated(token, msg.sender, preset, raiseTarget, name, symbol);
    }

    // -------------------------------------------------------------- trading

    /// @notice Buy tokens on the bonding curve with USDC.
    ///         If the purchase would overshoot the curve, the surplus USDC is
    ///         refunded and the market graduates in the same transaction.
    function buy(
        address token,
        uint256 usdcIn,
        uint256 minTokensOut
    ) external nonReentrant whenNotPaused returns (uint256 tokensOut) {
        Coin storage c = _liveCoin(token);
        if (usdcIn == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        uint256 totalFeeBps = vaultFeeBps + platformFeeBps;
        uint256 fee = (usdcIn * totalFeeBps) / BPS;
        uint256 net = usdcIn - fee;

        uint256 k = _k(c);
        uint256 vU = c.virtualUsdc;
        uint256 vT = c.virtualToken;
        uint256 newVU = vU + net;
        tokensOut = vT - Math.ceilDiv(k, newVU);

        uint256 remaining = CURVE_SUPPLY - c.tokensSold;
        uint256 refund = 0;
        if (tokensOut >= remaining) {
            // Finish the curve exactly; charge fees only on what was used.
            tokensOut = remaining;
            newVU = Math.ceilDiv(k, vT - remaining);
            net = newVU - vU;
            uint256 grossUsed = Math.ceilDiv(net * BPS, BPS - totalFeeBps);
            if (grossUsed > usdcIn) grossUsed = usdcIn;
            fee = grossUsed - net;
            refund = usdcIn - grossUsed;
        }
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        _routeTradeFee(c, fee, totalFeeBps);

        c.virtualUsdc = uint128(newVU);
        c.virtualToken = uint128(vT - tokensOut);
        c.realUsdc += uint128(net);
        c.tokensSold += uint128(tokensOut);

        IERC20(token).safeTransfer(msg.sender, tokensOut);
        if (refund > 0) usdc.safeTransfer(msg.sender, refund);
        emit Trade(token, msg.sender, true, usdcIn - refund, tokensOut);

        if (c.tokensSold >= CURVE_SUPPLY) _graduate(token, c);
    }

    /// @notice Sell tokens back into the bonding curve for USDC.
    ///         Intentionally not pausable: exits always work.
    function sell(
        address token,
        uint256 tokensIn,
        uint256 minUsdcOut
    ) external nonReentrant returns (uint256 usdcOut) {
        Coin storage c = _liveCoin(token);
        if (tokensIn == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokensIn);

        uint256 vU = c.virtualUsdc;
        uint256 vT = c.virtualToken;
        uint256 gross = vU - Math.ceilDiv(_k(c), vT + tokensIn);

        uint256 totalFeeBps = vaultFeeBps + platformFeeBps;
        uint256 fee = (gross * totalFeeBps) / BPS;
        usdcOut = gross - fee;
        if (usdcOut < minUsdcOut) revert SlippageExceeded();

        _routeTradeFee(c, fee, totalFeeBps);

        c.virtualUsdc = uint128(vU - gross);
        c.virtualToken = uint128(vT + tokensIn);
        c.realUsdc -= uint128(gross);
        c.tokensSold -= uint128(tokensIn);

        usdc.safeTransfer(msg.sender, usdcOut);
        emit Trade(token, msg.sender, false, usdcOut, tokensIn);
    }

    // ------------------------------------------------------------- buybacks

    /// @notice Spend part of a coin's buyback budget and burn the proceeds.
    ///         Callable by anyone: the budget can only ever buy and burn.
    /// @param minTokensBurned Slippage floor: revert if the buyback would burn
    ///        fewer tokens than this. Protects the budget from sandwich MEV,
    ///        which matters most for the post-graduation pool swap.
    function executeBuyback(
        address token,
        uint256 usdcAmount,
        uint256 minTokensBurned
    ) external nonReentrant returns (uint256 tokensBurned) {
        Coin storage c = coins[token];
        if (c.creator == address(0)) revert UnknownCoin();
        if (usdcAmount == 0) revert ZeroAmount();
        if (usdcAmount > c.buybackBudget) revert BudgetExceeded();
        c.buybackBudget -= uint128(usdcAmount);

        if (!c.graduated) {
            // Fee-free buy on the curve, burned straight from our own balance.
            uint256 k = _k(c);
            uint256 vU = c.virtualUsdc;
            uint256 vT = c.virtualToken;
            uint256 newVU = vU + usdcAmount;
            tokensBurned = vT - Math.ceilDiv(k, newVU);

            uint256 remaining = CURVE_SUPPLY - c.tokensSold;
            if (tokensBurned >= remaining) {
                tokensBurned = remaining;
                newVU = Math.ceilDiv(k, vT - remaining);
                uint256 used = newVU - vU;
                c.buybackBudget += uint128(usdcAmount - used);
                usdcAmount = used;
            }

            c.virtualUsdc = uint128(newVU);
            c.virtualToken = uint128(vT - tokensBurned);
            c.realUsdc += uint128(usdcAmount);
            c.tokensSold += uint128(tokensBurned);

            ArcPadToken(token).burn(tokensBurned);
            emit Buyback(token, usdcAmount, tokensBurned);

            if (c.tokensSold >= CURVE_SUPPLY) _graduate(token, c);
        } else {
            bool zeroForOne = address(usdc) < token;
            (int256 amount0, int256 amount1) = IUniswapV3Pool(c.pool).swap(
                address(this),
                zeroForOne,
                int256(usdcAmount),
                zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
                abi.encode(token)
            );
            tokensBurned = uint256(-(zeroForOne ? amount1 : amount0));
            ArcPadToken(token).burn(tokensBurned);
            emit Buyback(token, usdcAmount, tokensBurned);
        }

        if (tokensBurned < minTokensBurned) revert SlippageExceeded();
    }

    /// @dev V3 swap callback: pay the USDC we owe. Only the coin's own pool
    ///      (created by the trusted factory at graduation) may call this.
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        _paySwapCallback(amount0Delta, amount1Delta, data);
    }

    /// @dev Same callback under the name used by UNITFLOW pools on Arc
    ///      testnet (fork renames it, like Pancake does).
    function unitFlowV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        _paySwapCallback(amount0Delta, amount1Delta, data);
    }

    function _paySwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) private {
        address token = abi.decode(data, (address));
        if (msg.sender != coins[token].pool || coins[token].pool == address(0)) {
            revert NotPool();
        }
        uint256 owed = uint256(amount0Delta > 0 ? amount0Delta : amount1Delta);
        usdc.safeTransfer(msg.sender, owed);
    }

    // ----------------------------------------------------------------- fees

    /// @notice Withdraw all USDC fees accrued to the caller.
    function claimFees() external nonReentrant returns (uint256 amount) {
        amount = claimableFees[msg.sender];
        if (amount == 0) revert ZeroAmount();
        claimableFees[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit FeesClaimed(msg.sender, amount);
    }

    /// @notice Harvest LP fees of a graduated coin. USDC flows through the
    ///         vault preset (platform keeps its usual share); tokens burn.
    function collectPoolFees(
        address token
    ) external nonReentrant returns (uint256 usdcAmount, uint256 tokensBurned) {
        Coin storage c = coins[token];
        if (c.creator == address(0)) revert UnknownCoin();
        if (!c.graduated) revert UnknownCoin();

        (uint256 a0, uint256 a1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: c.lpTokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        (usdcAmount, tokensBurned) = address(usdc) < token ? (a0, a1) : (a1, a0);

        if (tokensBurned > 0) ArcPadToken(token).burn(tokensBurned);
        if (usdcAmount > 0) {
            uint256 totalFeeBps = vaultFeeBps + platformFeeBps;
            uint256 platformCut = totalFeeBps == 0
                ? 0
                : (usdcAmount * platformFeeBps) / totalFeeBps;
            claimableFees[protocolTreasury] += platformCut;
            _routeVaultFee(c, usdcAmount - platformCut);
        }
        emit PoolFeesCollected(token, usdcAmount, tokensBurned);
    }

    /// @dev Split a trade fee into the platform part and the vault part.
    function _routeTradeFee(
        Coin storage c,
        uint256 fee,
        uint256 totalFeeBps
    ) private {
        if (fee == 0) return;
        uint256 platformCut = totalFeeBps == 0
            ? 0
            : (fee * platformFeeBps) / totalFeeBps;
        claimableFees[protocolTreasury] += platformCut;
        _routeVaultFee(c, fee - platformCut);
    }

    /// @dev Route the vault share according to the coin's preset. Percentages
    ///      mirror the ArcPad UI copy, normalized to 100% of the vault share.
    ///      Rounding dust goes to the platform.
    function _routeVaultFee(Coin storage c, uint256 amount) private {
        if (amount == 0) return;
        (uint256 cr, uint256 bo, uint256 tr, uint256 ag, uint256 bb) = _splitBps(
            c.preset
        );
        uint256 toCreator = (amount * cr) / BPS;
        uint256 toBounty = (amount * bo) / BPS;
        uint256 toTreasury = (amount * tr) / BPS;
        uint256 toAgent = (amount * ag) / BPS;
        uint256 toBuyback = (amount * bb) / BPS;

        if (toCreator > 0) claimableFees[c.creator] += toCreator;
        if (toBounty > 0) claimableFees[c.bountyWallet] += toBounty;
        if (toTreasury > 0) claimableFees[c.treasuryWallet] += toTreasury;
        if (toAgent > 0) claimableFees[c.agentWallet] += toAgent;
        if (toBuyback > 0) c.buybackBudget += uint128(toBuyback);

        uint256 dust = amount -
            toCreator -
            toBounty -
            toTreasury -
            toAgent -
            toBuyback;
        if (dust > 0) claimableFees[protocolTreasury] += dust;
    }

    function _splitBps(
        Preset preset
    )
        private
        pure
        returns (uint256 cr, uint256 bo, uint256 tr, uint256 ag, uint256 bb)
    {
        if (preset == Preset.Grow) return (3750, 3750, 2500, 0, 0);
        if (preset == Preset.Agent) return (2500, 1250, 0, 6250, 0);
        if (preset == Preset.Burn) return (2500, 0, 1250, 0, 6250);
        return (7650, 1175, 1175, 0, 0); // Preset.Creator
    }

    // ----------------------------------------------------------- graduation

    /// @dev Move the market from the curve to a locked full-range V3 position
    ///      at the exact final curve price.
    function _graduate(address token, Coin storage c) private {
        c.graduated = true;

        uint256 raised = c.realUsdc;
        uint256 gradFee = (raised * graduationFeeBps) / BPS;
        claimableFees[protocolTreasury] += gradFee;
        uint256 available = raised - gradFee;

        uint256 tokensToLp = TOTAL_SUPPLY - CURVE_SUPPLY;
        // Price continuity: final curve price = virtualUsdc / virtualToken.
        uint256 usdcToLp = Math.mulDiv(tokensToLp, c.virtualUsdc, c.virtualToken);
        if (usdcToLp > available) usdcToLp = available;

        (address t0, address t1) = address(usdc) < token
            ? (address(usdc), token)
            : (token, address(usdc));
        (uint256 a0, uint256 a1) = t0 == address(usdc)
            ? (usdcToLp, tokensToLp)
            : (tokensToLp, usdcToLp);

        // The pool was created and initialized at the true final price in
        // createCoin, so it cannot have been seeded at a bogus price. The
        // fallback initialize is defensive only (unreachable for our coins).
        address pool = c.pool;
        (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(pool).slot0();
        if (sqrtPriceX96 == 0) {
            (, , uint160 gSqrt) = _gradPlan(token, c.virtualUsdc0);
            IUniswapV3Pool(pool).initialize(gSqrt);
        }

        usdc.forceApprove(address(positionManager), usdcToLp);
        IERC20(token).forceApprove(address(positionManager), tokensToLp);
        (uint256 lpTokenId, , uint256 used0, uint256 used1) = positionManager
            .mint(
                INonfungiblePositionManager.MintParams({
                    token0: t0,
                    token1: t1,
                    fee: POOL_FEE,
                    tickLower: MIN_TICK,
                    tickUpper: MAX_TICK,
                    amount0Desired: a0,
                    amount1Desired: a1,
                    // Require the mint to consume most of each intended side;
                    // a skewed pool price would deposit lopsidedly and revert.
                    amount0Min: (a0 * MINT_MIN_BPS) / BPS,
                    amount1Min: (a1 * MINT_MIN_BPS) / BPS,
                    recipient: address(this),
                    deadline: block.timestamp
                })
            );
        usdc.forceApprove(address(positionManager), 0);
        IERC20(token).forceApprove(address(positionManager), 0);

        c.pool = pool;
        c.lpTokenId = lpTokenId;

        (uint256 usedUsdc, uint256 usedToken) = t0 == address(usdc)
            ? (used0, used1)
            : (used1, used0);
        uint256 tokenDust = tokensToLp - usedToken;
        if (tokenDust > 0) ArcPadToken(token).burn(tokenDust);
        uint256 usdcDust = available - usedUsdc;
        if (usdcDust > 0) claimableFees[protocolTreasury] += usdcDust;

        emit Graduated(token, pool, lpTokenId, usedToken, usedUsdc);
    }

    // ---------------------------------------------------------------- views

    function coinCount() external view returns (uint256) {
        return allCoins.length;
    }

    /// @notice Quote a curve buy. Returns the tokens received and the USDC
    ///         that would actually be spent (less when finishing the curve).
    function quoteBuy(
        address token,
        uint256 usdcIn
    ) external view returns (uint256 tokensOut, uint256 usdcSpent) {
        Coin storage c = coins[token];
        if (c.creator == address(0) || c.graduated || usdcIn == 0) return (0, 0);

        uint256 totalFeeBps = vaultFeeBps + platformFeeBps;
        uint256 k = _k(c);
        uint256 net = usdcIn - (usdcIn * totalFeeBps) / BPS;
        tokensOut = c.virtualToken - Math.ceilDiv(k, c.virtualUsdc + net);
        usdcSpent = usdcIn;

        uint256 remaining = CURVE_SUPPLY - c.tokensSold;
        if (tokensOut >= remaining) {
            tokensOut = remaining;
            uint256 netUsed = Math.ceilDiv(k, c.virtualToken - remaining) -
                c.virtualUsdc;
            uint256 grossUsed = Math.ceilDiv(netUsed * BPS, BPS - totalFeeBps);
            usdcSpent = grossUsed > usdcIn ? usdcIn : grossUsed;
        }
    }

    /// @notice Quote a curve sell: USDC received after fees.
    function quoteSell(
        address token,
        uint256 tokensIn
    ) external view returns (uint256 usdcOut) {
        Coin storage c = coins[token];
        if (c.creator == address(0) || c.graduated || tokensIn == 0) return 0;
        uint256 gross = c.virtualUsdc -
            Math.ceilDiv(_k(c), uint256(c.virtualToken) + tokensIn);
        usdcOut = gross - (gross * (vaultFeeBps + platformFeeBps)) / BPS;
    }

    /// @notice Current spot price in USDC (6 decimals) per whole token.
    function currentPrice(address token) external view returns (uint256) {
        Coin storage c = coins[token];
        if (c.creator == address(0)) return 0;
        return Math.mulDiv(c.virtualUsdc, 1e18, c.virtualToken);
    }

    /// @notice Bonding progress in bps (10000 = ready to graduate).
    function curveProgressBps(address token) external view returns (uint256) {
        Coin storage c = coins[token];
        if (c.creator == address(0)) return 0;
        if (c.graduated) return BPS;
        return (uint256(c.tokensSold) * BPS) / CURVE_SUPPLY;
    }

    // ---------------------------------------------------------------- admin

    function setFees(
        uint256 vaultFeeBps_,
        uint256 platformFeeBps_
    ) external onlyOwner {
        if (vaultFeeBps_ + platformFeeBps_ > MAX_TOTAL_FEE_BPS) revert FeeTooHigh();
        vaultFeeBps = vaultFeeBps_;
        platformFeeBps = platformFeeBps_;
        emit FeesUpdated(vaultFeeBps_, platformFeeBps_);
    }

    function setCreationFee(uint256 creationFee_) external onlyOwner {
        if (creationFee_ > 100e6) revert FeeTooHigh();
        creationFee = creationFee_;
    }

    function setGraduationFeeBps(uint256 graduationFeeBps_) external onlyOwner {
        if (graduationFeeBps_ > MAX_GRADUATION_FEE_BPS) revert FeeTooHigh();
        graduationFeeBps = graduationFeeBps_;
    }

    /// @notice Allow or disallow a graduation raise target for new coins.
    function setRaiseTarget(uint256 raiseTarget, bool allowed) external onlyOwner {
        if (raiseTarget < MIN_RAISE_TARGET || raiseTarget > 1_000_000e6)
            revert InvalidRaiseTarget();
        allowedRaiseTargets[raiseTarget] = allowed;
        emit RaiseTargetSet(raiseTarget, allowed);
    }

    function setProtocolTreasury(address treasury) external onlyOwner {
        if (treasury == address(0)) revert ZeroAddress();
        protocolTreasury = treasury;
        emit ProtocolTreasuryUpdated(treasury);
    }

    /// @notice Pause coin creation and buys. Sells and claims never pause.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ------------------------------------------------------------- internal

    function _liveCoin(address token) private view returns (Coin storage c) {
        c = coins[token];
        if (c.creator == address(0)) revert UnknownCoin();
        if (c.graduated) revert AlreadyGraduated();
    }
}
