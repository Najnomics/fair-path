// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ISearcherBond {
    function asset() external view returns (address);
    function minBond() external view returns (uint256);
    function bondedOf(address searcher) external view returns (uint256);
    function slash(address searcher, uint256 amount, address recipient) external returns (uint256 paid);
}
