// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

/// @notice Do not mint extra ERC-20s. Each product has one pool: its original
///         two mocks (bond asset included where the hook bonds). Extra USDC/WETH
///         deploys left wallets with four tokens and broke slash/bid donate.
contract SeedWethUsdcScript is Script {
    function run() public view {
        console2.log("Refusing to mint a second pair.");
        console2.log("Console points at the original two-token pool in deployed.json.");
        revert("no extra currencies");
    }
}
