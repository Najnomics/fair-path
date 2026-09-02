// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IFairFlowPolicy} from "./interfaces/IFairFlowPolicy.sol";
import {IFlashblockOracle} from "./interfaces/IFlashblockOracle.sol";
import {IFlashblockNumber} from "./interfaces/IFlashblockNumber.sol";
import {IBlockBuilderPolicy} from "./interfaces/IBlockBuilderPolicy.sol";

/// @title UnichainFairOracle
/// @notice Production fairness + slot oracle. Two backends:
///         1. Canonical Unichain `FlashblockNumber` (TEE builders increment it).
///         2. Local permissioned feed: only `builders[addr]` may increment
///            (owner seeds those addresses from FlashtestationRegistry / TEE keys).
///
///         This is not a permissionless "open window" mock. Attestation is
///         either a live Unichain feed or an owner-gated builder set.
contract UnichainFairOracle is Ownable, IFairFlowPolicy, IFlashblockOracle {
    uint8 public constant MAX_SLOT = 4;

    IFlashblockNumber public flashblockNumberContract;
    IBlockBuilderPolicy public blockBuilderPolicy;

    mapping(address => bool) public builders;
    uint256 public localFlashblockNumber;
    uint256 public lastIncrementBlock;

    event BuilderSet(address indexed builder, bool allowed);
    event ExternalFeedSet(address indexed flashblockNumber, address indexed policy);
    event FlashblockIncremented(uint256 indexed number, address indexed builder);

    error NotBuilder();
    error ExternalFeedActive();

    constructor(address owner_, address flashblockNumber_, address blockBuilderPolicy_) Ownable(owner_) {
        if (flashblockNumber_ != address(0)) {
            flashblockNumberContract = IFlashblockNumber(flashblockNumber_);
        }
        if (blockBuilderPolicy_ != address(0)) {
            blockBuilderPolicy = IBlockBuilderPolicy(blockBuilderPolicy_);
        }
    }

    function setExternalFeed(address flashblockNumber_, address blockBuilderPolicy_) external onlyOwner {
        flashblockNumberContract = IFlashblockNumber(flashblockNumber_);
        blockBuilderPolicy = IBlockBuilderPolicy(blockBuilderPolicy_);
        emit ExternalFeedSet(flashblockNumber_, blockBuilderPolicy_);
    }

    function setBuilder(address builder, bool allowed) external onlyOwner {
        builders[builder] = allowed;
        emit BuilderSet(builder, allowed);
    }

    /// @notice TEE / authorized builder heartbeat. Required on the local feed.
    function incrementFlashblock() external {
        if (address(flashblockNumberContract) != address(0)) revert ExternalFeedActive();
        if (!builders[msg.sender]) {
            if (address(blockBuilderPolicy) != address(0)) {
                (bool allowed,) = blockBuilderPolicy.isAllowedPolicy(msg.sender);
                if (!allowed) revert NotBuilder();
            } else {
                revert NotBuilder();
            }
        }
        unchecked {
            ++localFlashblockNumber;
        }
        lastIncrementBlock = block.number;
        emit FlashblockIncremented(localFlashblockNumber, msg.sender);
    }

    function getFlashblockNumber() public view returns (uint256) {
        if (address(flashblockNumberContract) != address(0)) {
            return flashblockNumberContract.getFlashblockNumber();
        }
        return localFlashblockNumber;
    }

    /// @inheritdoc IFairFlowPolicy
    function isFair(uint256 blockNumber) public view returns (bool) {
        if (address(flashblockNumberContract) != address(0)) {
            // Live Unichain: TEE builders are the sequencer. A non-zero feed means
            // attested sequencing is running. Slot + bond still price first-look.
            return flashblockNumberContract.getFlashblockNumber() > 0;
        }
        return lastIncrementBlock == blockNumber && localFlashblockNumber > 0;
    }

    function fairUntilBlock() external view returns (uint256) {
        if (address(flashblockNumberContract) != address(0)) {
            return isFair(block.number) ? block.number : 0;
        }
        return lastIncrementBlock;
    }

    /// @inheritdoc IFlashblockOracle
    function slot() public view returns (uint8) {
        return uint8(getFlashblockNumber() % (uint256(MAX_SLOT) + 1));
    }

    function maxSlot() external pure returns (uint8) {
        return MAX_SLOT;
    }
}
