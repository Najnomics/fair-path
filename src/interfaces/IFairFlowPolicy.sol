// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IFairFlowPolicy {
    function isFair(uint256 blockNumber) external view returns (bool);
    function fairUntilBlock() external view returns (uint256);
}
