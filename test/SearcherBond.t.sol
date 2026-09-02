// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {SearcherBond} from "../src/SearcherBond.sol";

contract SearcherBondTest is Test {
    MockERC20 token;
    SearcherBond bonds;
    address alice = address(0xA11CE);

    function setUp() public {
        token = new MockERC20("BOND", "BOND", 18);
        bonds = new SearcherBond(address(this), IERC20(address(token)), 1e18, 3);
        token.mint(alice, 100e18);
        vm.prank(alice);
        token.approve(address(bonds), type(uint256).max);
    }

    function test_belowMinBondReverts() public {
        vm.prank(alice);
        vm.expectRevert(SearcherBond.BelowMinBond.selector);
        bonds.bond(0.5e18);
    }

    function test_zeroBondReverts() public {
        vm.prank(alice);
        vm.expectRevert(SearcherBond.ZeroAmount.selector);
        bonds.bond(0);
    }

    function test_setHookZeroReverts() public {
        vm.expectRevert(SearcherBond.ZeroAddress.selector);
        bonds.setHook(address(0));
    }

    function test_onlyOwnerSetters() public {
        vm.prank(alice);
        vm.expectRevert();
        bonds.setMinBond(2);
        bonds.setMinBond(2e18);
        bonds.setUnbondDelay(10);
        assertEq(bonds.minBond(), 2e18);
        assertEq(bonds.unbondDelay(), 10);
    }

    function test_unauthorizedSlashReverts() public {
        vm.prank(alice);
        bonds.bond(5e18);
        vm.expectRevert(SearcherBond.NotHook.selector);
        bonds.slash(alice, 1e18, address(this));
    }

    function test_queueUnbondPartialBelowMinReverts() public {
        vm.prank(alice);
        bonds.bond(5e18);
        vm.prank(alice);
        vm.expectRevert(SearcherBond.BelowMinBond.selector);
        bonds.queueUnbond(4.5e18);
    }

    function test_insufficientUnbond() public {
        vm.prank(alice);
        bonds.bond(2e18);
        vm.prank(alice);
        vm.expectRevert(SearcherBond.InsufficientBond.selector);
        bonds.queueUnbond(3e18);
    }

    function test_claimZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(SearcherBond.ZeroAmount.selector);
        bonds.claimUnbond();
    }

    function test_slashCapsAtBalance() public {
        vm.prank(alice);
        bonds.bond(2e18);
        bonds.setHook(address(this));
        uint256 paid = bonds.slash(alice, 99e18, address(this));
        assertEq(paid, 2e18);
        assertEq(bonds.bondedOf(alice), 0);
    }

    function test_slashZeroReturnsZero() public {
        bonds.setHook(address(this));
        assertEq(bonds.slash(alice, 1e18, address(this)), 0);
    }
}
