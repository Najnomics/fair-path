// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IFlashblockOracle {
    /// @return Flashblock index in [0, maxSlot]. 0 is first-look.
    function slot() external view returns (uint8);
    function maxSlot() external view returns (uint8);
}
