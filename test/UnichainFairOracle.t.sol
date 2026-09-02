// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {UnichainFairOracle} from "../src/UnichainFairOracle.sol";
import {IFlashblockNumber} from "../src/interfaces/IFlashblockNumber.sol";
import {IBlockBuilderPolicy} from "../src/interfaces/IBlockBuilderPolicy.sol";

contract MockFlashblockNumber is IFlashblockNumber {
    uint256 public n;
    function set(uint256 v) external { n = v; }
    function getFlashblockNumber() external view returns (uint256) { return n; }
    function policy() external pure returns (address) { return address(0); }
    function registry() external pure returns (address) { return address(0); }
}

contract MockBuilderPolicy is IBlockBuilderPolicy {
    mapping(address => bool) public allowed;
    function set(address a, bool v) external { allowed[a] = v; }
    function isAllowedPolicy(address tee) external view returns (bool, bytes32) {
        return (allowed[tee], bytes32(0));
    }
}

contract UnichainFairOracleTest is Test {
    UnichainFairOracle oracle;
    address builder = address(0xB11D);

    function setUp() public {
        oracle = new UnichainFairOracle(address(this), address(0), address(0));
    }

    function test_zeroBuilderReverts() public {
        vm.expectRevert(UnichainFairOracle.ZeroAddress.selector);
        oracle.setBuilder(address(0), true);
    }

    function test_localFairOnlySameBlock() public {
        oracle.setBuilder(builder, true);
        vm.prank(builder);
        oracle.incrementFlashblock();
        assertTrue(oracle.isFair(block.number));
        assertEq(oracle.fairUntilBlock(), block.number);
        assertEq(oracle.slot(), 1 % 5);
        assertEq(oracle.maxSlot(), 4);
        vm.roll(block.number + 1);
        assertFalse(oracle.isFair(block.number));
    }

    function test_externalFeed() public {
        MockFlashblockNumber fb = new MockFlashblockNumber();
        MockBuilderPolicy pol = new MockBuilderPolicy();
        oracle.setExternalFeed(address(fb), address(pol));
        assertFalse(oracle.isFair(1));
        assertEq(oracle.fairUntilBlock(), 0);
        fb.set(12);
        assertTrue(oracle.isFair(999));
        assertEq(oracle.fairUntilBlock(), block.number);
        assertEq(oracle.slot(), uint8(12 % 5));
        vm.expectRevert(UnichainFairOracle.ExternalFeedActive.selector);
        oracle.incrementFlashblock();
    }

    function test_policyAllowlistIncrement() public {
        MockBuilderPolicy pol = new MockBuilderPolicy();
        UnichainFairOracle o = new UnichainFairOracle(address(this), address(0), address(pol));
        pol.set(builder, true);
        vm.prank(builder);
        o.incrementFlashblock();
        assertEq(o.getFlashblockNumber(), 1);
    }

    function test_policyDenyReverts() public {
        MockBuilderPolicy pol = new MockBuilderPolicy();
        UnichainFairOracle o = new UnichainFairOracle(address(this), address(0), address(pol));
        vm.prank(builder);
        vm.expectRevert(UnichainFairOracle.NotBuilder.selector);
        o.incrementFlashblock();
    }
}
