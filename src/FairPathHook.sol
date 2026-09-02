// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {CurrencySettler} from "@uniswap/v4-core/test/utils/CurrencySettler.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {IFairFlowPolicy} from "./interfaces/IFairFlowPolicy.sol";
import {IFlashblockOracle} from "./interfaces/IFlashblockOracle.sol";
import {ISearcherBond} from "./interfaces/ISearcherBond.sol";

/// @title FairPathHook
/// @notice Three-corridor Uniswap v4 hook:
///         1. Attested / TEE-sequenced blocks → ATTESTED_FEE, no tax.
///         2. Unattested + bonded searcher → SLOT_FEE[flashblock slot].
///         3. Unattested + unbonded → TOXIC_FEE + donate tax.
///         Same-block opposite-direction swap from a bonded searcher slashes
///         the bond and donates it to in-range LPs.
contract FairPathHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using LPFeeLibrary for uint24;
    using CurrencySettler for Currency;
    using SafeCast for uint256;

    error NotDynamicFee();
    error BadHookData();

    uint24 public constant ATTESTED_FEE = 500;
    uint24 public constant TOXIC_FEE = 10_000;
    uint256 public constant TOXIC_TAX_BIPS = 50;
    uint256 public constant SLASH_BIPS = 2_000; // 20% of bond
    uint24 public constant SLOT0_FEE = 8_000;
    uint24 public constant SLOT1_FEE = 5_000;
    uint24 public constant SLOT2_FEE = 3_000;
    uint24 public constant SLOT3_FEE = 1_500;
    uint24 public constant SLOT4_FEE = 750;

    IFairFlowPolicy public immutable policy;
    IFlashblockOracle public immutable flashblocks;
    ISearcherBond public immutable bonds;

    enum Corridor {
        Attested,
        BondedSlot,
        Toxic
    }

    struct LastSwap {
        Corridor corridor;
        uint24 fee;
        uint256 taxAmount;
        address taxCurrency;
        address searcher;
        uint8 slot;
        uint256 blockNumber;
        bool zeroForOne;
    }

    struct SearcherTrace {
        uint256 blockNumber;
        bool zeroForOne;
        bool exists;
    }

    mapping(PoolId => LastSwap) public lastSwap;
    mapping(PoolId => uint256) public totalTaxDonated;
    mapping(PoolId => mapping(address => SearcherTrace)) public lastBySearcher;

    event SwapClassified(
        PoolId indexed poolId,
        address indexed searcher,
        Corridor corridor,
        uint24 swapFee,
        uint8 slot,
        uint256 taxAmount,
        address taxCurrency
    );
    event BondSlashed(PoolId indexed poolId, address indexed searcher, uint256 amount);

    constructor(IPoolManager _poolManager, IFairFlowPolicy _policy, IFlashblockOracle _flashblocks, ISearcherBond _bonds)
        BaseHook(_poolManager)
    {
        policy = _policy;
        flashblocks = _flashblocks;
        bonds = _bonds;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _afterInitialize(address, PoolKey calldata key, uint160, int24) internal pure override returns (bytes4) {
        if (!key.fee.isDynamicFee()) revert NotDynamicFee();
        return this.afterInitialize.selector;
    }

    function _beforeSwap(address sender, PoolKey calldata, SwapParams calldata, bytes calldata hookData)
        internal
        view
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        address searcher = _searcher(sender, hookData);
        (, uint24 fee,) = _classify(searcher);
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128 hookDeltaUnspecified) {
        PoolId poolId = key.toId();
        address searcher = _searcher(sender, hookData);
        (Corridor corridor, uint24 fee, uint8 slot_) = _classify(searcher);

        uint256 taxAmount;
        address taxCurrency;
        int128 taxDelta;

        if (corridor == Corridor.Toxic) {
            (taxAmount, taxCurrency, taxDelta) = _recapture(poolId, key, params, delta);
        } else if (corridor == Corridor.BondedSlot) {
            taxDelta = _maybeSlash(poolId, key, params, searcher);
            taxAmount = uint256(uint128(taxDelta < 0 ? int128(0) : taxDelta));
        }

        lastSwap[poolId] = LastSwap({
            corridor: corridor,
            fee: fee,
            taxAmount: taxAmount,
            taxCurrency: taxCurrency,
            searcher: searcher,
            slot: slot_,
            blockNumber: block.number,
            zeroForOne: params.zeroForOne
        });

        lastBySearcher[poolId][searcher] =
            SearcherTrace({blockNumber: block.number, zeroForOne: params.zeroForOne, exists: true});

        hookDeltaUnspecified = taxDelta;
        emit SwapClassified(poolId, searcher, corridor, fee, slot_, taxAmount, taxCurrency);
        return (this.afterSwap.selector, hookDeltaUnspecified);
    }

    function _classify(address searcher) internal view returns (Corridor, uint24 fee, uint8 slot_) {
        slot_ = flashblocks.slot();
        if (policy.isFair(block.number)) {
            return (Corridor.Attested, ATTESTED_FEE, slot_);
        }
        if (bonds.bondedOf(searcher) >= bonds.minBond() && bonds.minBond() > 0) {
            return (Corridor.BondedSlot, _slotFee(slot_), slot_);
        }
        if (bonds.minBond() == 0 && bonds.bondedOf(searcher) > 0) {
            return (Corridor.BondedSlot, _slotFee(slot_), slot_);
        }
        return (Corridor.Toxic, TOXIC_FEE, slot_);
    }

    function slotFee(uint8 slot_) public pure returns (uint24) {
        return _slotFee(slot_);
    }

    function _slotFee(uint8 slot_) internal pure returns (uint24) {
        if (slot_ == 0) return SLOT0_FEE;
        if (slot_ == 1) return SLOT1_FEE;
        if (slot_ == 2) return SLOT2_FEE;
        if (slot_ == 3) return SLOT3_FEE;
        return SLOT4_FEE;
    }

    function _searcher(address sender, bytes calldata hookData) internal pure returns (address) {
        if (hookData.length == 0) return sender;
        if (hookData.length != 32) revert BadHookData();
        address a = abi.decode(hookData, (address));
        if (a == address(0)) revert BadHookData();
        return a;
    }

    function _maybeSlash(PoolId poolId, PoolKey calldata key, SwapParams calldata params, address searcher)
        internal
        returns (int128 hookDelta)
    {
        SearcherTrace memory prev = lastBySearcher[poolId][searcher];
        if (!prev.exists || prev.blockNumber != block.number || prev.zeroForOne == params.zeroForOne) {
            return 0;
        }
        uint256 bal = bonds.bondedOf(searcher);
        uint256 cut = bal * SLASH_BIPS / 10_000;
        if (cut == 0) return 0;

        uint256 paid = bonds.slash(searcher, cut, address(this));
        if (paid == 0) return 0;

        address asset = bonds.asset();
        uint256 amt0 = asset == Currency.unwrap(key.currency0) ? paid : 0;
        uint256 amt1 = asset == Currency.unwrap(key.currency1) ? paid : 0;
        if (amt0 == 0 && amt1 == 0) {
            // Bond asset is not a pool token; leave capital on the hook for LPs to be
            // paid via a later matching-pool deployment. Still emit the slash.
            emit BondSlashed(poolId, searcher, paid);
            return 0;
        }

        Currency feeCurrency = Currency.wrap(asset);
        poolManager.donate(key, amt0, amt1, "");
        feeCurrency.settle(poolManager, address(this), paid, false);
        totalTaxDonated[poolId] += paid;
        emit BondSlashed(poolId, searcher, paid);
        return 0;
    }

    function _recapture(PoolId poolId, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta)
        internal
        returns (uint256 taxAmount, address taxCurrency, int128 hookDelta)
    {
        bool specifiedTokenIs0 = (params.amountSpecified < 0) == params.zeroForOne;
        Currency feeCurrency = specifiedTokenIs0 ? key.currency1 : key.currency0;
        int128 swapAmount = specifiedTokenIs0 ? delta.amount1() : delta.amount0();
        if (swapAmount < 0) swapAmount = -swapAmount;

        taxAmount = uint256(uint128(swapAmount)) * TOXIC_TAX_BIPS / 10_000;
        if (taxAmount == 0) return (0, address(0), 0);

        taxCurrency = Currency.unwrap(feeCurrency);
        feeCurrency.take(poolManager, address(this), taxAmount, false);
        poolManager.donate(key, specifiedTokenIs0 ? 0 : taxAmount, specifiedTokenIs0 ? taxAmount : 0, "");
        feeCurrency.settle(poolManager, address(this), taxAmount, false);
        totalTaxDonated[poolId] += taxAmount;
        hookDelta = taxAmount.toInt128();
    }
}
