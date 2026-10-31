// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test collateral for an isolated synthetic obligation. Not a stablecoin or aUSD.
/// @dev Supply is minted once to the issuer. No privileged mint or confiscation exists afterwards.
contract TestDividendUSD is ERC20 {
    constructor(address recipient, uint256 initialSupply) ERC20("Test Dividend USD", "tdUSD") {
        _mint(recipient, initialSupply);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
