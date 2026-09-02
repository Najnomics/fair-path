// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

/// @dev Live-network smoke. Skips when RPC is unset so CI without secrets still passes.
contract UnichainForkTest is Test {
    function test_unichainSepoliaFork() public {
        string memory url = vm.envOr("UNICHAIN_SEPOLIA_RPC_URL", string(""));
        if (bytes(url).length == 0) return;
        vm.createSelectFork(url);
        assertEq(block.chainid, 1301);
        assertGt(block.number, 0);
    }
}
