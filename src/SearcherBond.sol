// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISearcherBond} from "./interfaces/ISearcherBond.sol";

/// @title SearcherBond
/// @notice Capital posted by searchers for first-look access. Only the hook
///         may slash. Unbond is delayed so a sandwich cannot exit in the same
///         block as the violation.
contract SearcherBond is Ownable, ReentrancyGuard, ISearcherBond {
    using SafeERC20 for IERC20;

    IERC20 public immutable bondToken;
    address public hook;
    uint256 public minBond;
    uint256 public unbondDelay;

    mapping(address => uint256) public bondedOf;
    mapping(address => uint256) public pendingUnbond;
    mapping(address => uint256) public unbondReadyBlock;

    event HookSet(address indexed hook);
    event MinBondSet(uint256 minBond);
    event UnbondDelaySet(uint256 unbondDelay);
    event Bonded(address indexed searcher, uint256 amount, uint256 total);
    event UnbondQueued(address indexed searcher, uint256 amount, uint256 readyBlock);
    event UnbondClaimed(address indexed searcher, uint256 amount);
    event Slashed(address indexed searcher, uint256 amount, address indexed recipient);

    error NotHook();
    error BelowMinBond();
    error InsufficientBond();
    error UnbondNotReady();
    error ZeroAmount();
    error ZeroAddress();

    constructor(address owner_, IERC20 asset_, uint256 minBond_, uint256 unbondDelay_) Ownable(owner_) {
        bondToken = asset_;
        minBond = minBond_;
        unbondDelay = unbondDelay_;
    }

    function asset() external view returns (address) {
        return address(bondToken);
    }

    function setHook(address hook_) external onlyOwner {
        if (hook_ == address(0)) revert ZeroAddress();
        hook = hook_;
        emit HookSet(hook_);
    }

    function setMinBond(uint256 minBond_) external onlyOwner {
        minBond = minBond_;
        emit MinBondSet(minBond_);
    }

    function setUnbondDelay(uint256 unbondDelay_) external onlyOwner {
        unbondDelay = unbondDelay_;
        emit UnbondDelaySet(unbondDelay_);
    }

    function bond(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        bondToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 total = bondedOf[msg.sender] + amount;
        if (total < minBond) revert BelowMinBond();
        bondedOf[msg.sender] = total;
        emit Bonded(msg.sender, amount, total);
    }

    function queueUnbond(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = bondedOf[msg.sender];
        if (amount > bal) revert InsufficientBond();
        uint256 remaining = bal - amount;
        if (remaining != 0 && remaining < minBond) revert BelowMinBond();
        bondedOf[msg.sender] = remaining;
        pendingUnbond[msg.sender] += amount;
        unbondReadyBlock[msg.sender] = block.number + unbondDelay;
        emit UnbondQueued(msg.sender, amount, unbondReadyBlock[msg.sender]);
    }

    function claimUnbond() external nonReentrant {
        uint256 amount = pendingUnbond[msg.sender];
        if (amount == 0) revert ZeroAmount();
        if (block.number < unbondReadyBlock[msg.sender]) revert UnbondNotReady();
        pendingUnbond[msg.sender] = 0;
        unbondReadyBlock[msg.sender] = 0;
        bondToken.safeTransfer(msg.sender, amount);
        emit UnbondClaimed(msg.sender, amount);
    }

    function slash(address searcher, uint256 amount, address recipient)
        external
        nonReentrant
        returns (uint256 paid)
    {
        if (msg.sender != hook) revert NotHook();
        uint256 bal = bondedOf[searcher];
        paid = amount > bal ? bal : amount;
        if (paid == 0) return 0;
        bondedOf[searcher] = bal - paid;
        bondToken.safeTransfer(recipient, paid);
        emit Slashed(searcher, paid, recipient);
        return paid;
    }
}
