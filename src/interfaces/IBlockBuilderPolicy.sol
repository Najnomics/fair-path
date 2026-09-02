// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Flashbots BlockBuilderPolicy: is this TEE address on an approved workload?
interface IBlockBuilderPolicy {
    function isAllowedPolicy(address teeAddress) external view returns (bool allowed, bytes32 workloadId);
}
