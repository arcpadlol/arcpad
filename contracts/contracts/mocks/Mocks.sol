// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {INonfungiblePositionManager} from "../interfaces/IUniswapV3.sol";

/// Test doubles for the UNITFLOW (Uniswap V3) infrastructure on Arc testnet.
/// Only used by the hardhat test suite; never deployed.

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

interface ISwapCallback {
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
}

contract MockV3Pool {
    address public immutable token0;
    address public immutable token1;
    uint160 public sqrtPriceX96;

    constructor(address token0_, address token1_) {
        token0 = token0_;
        token1 = token1_;
    }

    function initialize(uint160 sqrtPriceX96_) external {
        require(sqrtPriceX96 == 0, "already init");
        sqrtPriceX96 = sqrtPriceX96_;
    }

    function slot0()
        external
        view
        returns (uint160, int24, uint16, uint16, uint16, uint8, bool)
    {
        return (sqrtPriceX96, 0, 0, 0, 0, 0, true);
    }

    /// Naive swap: pays out 1 token (18d) per 0.00005 USDC of input, enough
    /// to exercise the buyback path. The pool must be pre-funded with tokens.
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1) {
        uint256 usdcIn = uint256(amountSpecified);
        uint256 tokensOut = (usdcIn * 1e18) / 50; // 50 = 0.00005 USDC in 6d units
        if (zeroForOne) {
            (amount0, amount1) = (int256(usdcIn), -int256(tokensOut));
            IERC20(token1).transfer(recipient, tokensOut);
        } else {
            (amount0, amount1) = (-int256(tokensOut), int256(usdcIn));
            IERC20(token0).transfer(recipient, tokensOut);
        }
        ISwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);
    }
}

contract MockV3Factory {
    mapping(bytes32 => address) public pools;

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address) {
        return pools[keccak256(abi.encode(tokenA, tokenB, fee))];
    }

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool) {
        pool = address(new MockV3Pool(tokenA, tokenB));
        pools[keccak256(abi.encode(tokenA, tokenB, fee))] = pool;
    }

    function feeAmountTickSpacing(uint24) external pure returns (int24) {
        return 200;
    }
}

contract MockPositionManager {
    uint256 public nextId = 1;
    uint256 public lastAmount0;
    uint256 public lastAmount1;
    uint256 public collect0;
    uint256 public collect1;
    address public collectToken0;
    address public collectToken1;

    function mint(
        INonfungiblePositionManager.MintParams calldata p
    )
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        // Pull the full desired amounts, like a fresh full-range mint would
        // (minus negligible rounding) when the price matches the ratio.
        IERC20(p.token0).transferFrom(msg.sender, address(this), p.amount0Desired);
        IERC20(p.token1).transferFrom(msg.sender, address(this), p.amount1Desired);
        lastAmount0 = p.amount0Desired;
        lastAmount1 = p.amount1Desired;
        return (nextId++, 1e18, p.amount0Desired, p.amount1Desired);
    }

    /// Test helper: set the fee amounts the next collect() will pay out of
    /// this mock's own balance (fund it in the test first).
    function setCollectAmounts(
        address token0_,
        address token1_,
        uint256 amount0,
        uint256 amount1
    ) external {
        collectToken0 = token0_;
        collectToken1 = token1_;
        collect0 = amount0;
        collect1 = amount1;
    }

    function collect(
        INonfungiblePositionManager.CollectParams calldata p
    ) external payable returns (uint256 amount0, uint256 amount1) {
        amount0 = collect0;
        amount1 = collect1;
        if (amount0 > 0) IERC20(collectToken0).transfer(p.recipient, amount0);
        if (amount1 > 0) IERC20(collectToken1).transfer(p.recipient, amount1);
        collect0 = 0;
        collect1 = 0;
    }
}
