// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ArcPadToken
/// @notice Fixed-supply meme token launched through ArcPadLaunchpad.
///         The full supply is minted to the launchpad at creation; the
///         launchpad sells 80% on the bonding curve and pairs the rest
///         as DEX liquidity at graduation. No owner, no further minting.
contract ArcPadToken is ERC20 {
    address public immutable launchpad;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply_
    ) ERC20(name_, symbol_) {
        launchpad = msg.sender;
        _mint(msg.sender, supply_);
    }

    /// @notice Burn caller's tokens. Used by the launchpad for buybacks
    ///         and liquidity dust; open to anyone who wants to burn.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
