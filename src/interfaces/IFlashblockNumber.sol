// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Canonical Unichain / Flashbots FlashblockNumber surface.
interface IFlashblockNumber {
    function getFlashblockNumber() external view returns (uint256);
    function policy() external view returns (address);
    function registry() external view returns (address);
}
