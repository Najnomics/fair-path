// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {EasyPosm} from "./utils/libraries/EasyPosm.sol";
import {BaseTest} from "./utils/BaseTest.sol";

import {FairPathHook} from "../src/FairPathHook.sol";
import {UnichainFairOracle} from "../src/UnichainFairOracle.sol";
import {SearcherBond} from "../src/SearcherBond.sol";

contract FairPathHookTest is BaseTest {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    Currency currency0;
    Currency currency1;
    PoolKey poolKey;
    PoolId poolId;
    FairPathHook hook;
    UnichainFairOracle oracle;
    SearcherBond bonds;

    address searcher = address(0xB0B);

    function setUp() public {
        deployArtifactsAndLabel();
        (currency0, currency1) = deployCurrencyPair();

        oracle = new UnichainFairOracle(address(this), address(0), address(0));
        oracle.setBuilder(address(this), true);

        bonds = new SearcherBond(address(this), IERC20(Currency.unwrap(currency1)), 1e18, 2);

        address flags = address(
            uint160(
                Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                    | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
            ) ^ (0x4444 << 144)
        );
        bytes memory constructorArgs = abi.encode(poolManager, oracle, oracle, bonds);
        deployCodeTo("FairPathHook.sol:FairPathHook", constructorArgs, flags);
        hook = FairPathHook(flags);
        bonds.setHook(address(hook));

        poolKey = PoolKey(currency0, currency1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hook));
        poolId = poolKey.toId();
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        int24 tickLower = TickMath.minUsableTick(poolKey.tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(poolKey.tickSpacing);
        uint128 liquidityAmount = 100e18;
        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityAmount
        );
        positionManager.mint(
            poolKey,
            tickLower,
            tickUpper,
            liquidityAmount,
            amount0Expected + 1,
            amount1Expected + 1,
            address(this),
            block.timestamp,
            Constants.ZERO_BYTES
        );

        deal(Currency.unwrap(currency1), searcher, 50e18);
        vm.startPrank(searcher);
        IERC20(Currency.unwrap(currency1)).approve(address(bonds), type(uint256).max);
        vm.stopPrank();
    }

    function _swap(bytes memory hookData) internal {
        swapRouter.swapExactTokensForTokens({
            amountIn: 10e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: hookData,
            receiver: address(this),
            deadline: block.timestamp + 1
        });
    }

    function test_toxicUnbondedPaysTax() public {
        _swap("");
        (FairPathHook.Corridor corridor, uint24 fee, uint256 taxAmount,,,,,) = hook.lastSwap(poolId);
        assertEq(uint8(corridor), uint8(FairPathHook.Corridor.Toxic));
        assertEq(fee, hook.TOXIC_FEE());
        assertGt(taxAmount, 0);
        assertEq(hook.totalTaxDonated(poolId), taxAmount);
    }

    function test_attestedAfterBuilderHeartbeatHasNoTax() public {
        oracle.incrementFlashblock();
        _swap("");
        (FairPathHook.Corridor corridor, uint24 fee, uint256 taxAmount,,,,,) = hook.lastSwap(poolId);
        assertEq(uint8(corridor), uint8(FairPathHook.Corridor.Attested));
        assertEq(fee, hook.ATTESTED_FEE());
        assertEq(taxAmount, 0);
    }

    function test_unauthorizedIncrementReverts() public {
        vm.prank(searcher);
        vm.expectRevert(UnichainFairOracle.NotBuilder.selector);
        oracle.incrementFlashblock();
    }

    function test_bondedSearcherPaysSlotFee() public {
        vm.prank(searcher);
        bonds.bond(5e18);
        _swap(abi.encode(searcher));
        (FairPathHook.Corridor corridor, uint24 fee,,,,,,) = hook.lastSwap(poolId);
        assertEq(uint8(corridor), uint8(FairPathHook.Corridor.BondedSlot));
        assertEq(fee, hook.SLOT0_FEE()); // flashblock 0 % 5 == 0
        assertEq(hook.totalTaxDonated(poolId), 0);
    }

    function test_sameBlockOppositeSwapSlashesBond() public {
        vm.prank(searcher);
        bonds.bond(10e18);
        uint256 before = bonds.bondedOf(searcher);
        _swap(abi.encode(searcher));
        swapRouter.swapExactTokensForTokens({
            amountIn: 10e18,
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: abi.encode(searcher),
            receiver: address(this),
            deadline: block.timestamp + 1
        });
        assertLt(bonds.bondedOf(searcher), before);
        assertGt(hook.totalTaxDonated(poolId), 0);
    }

    function test_initStaticFeePoolReverts() public {
        PoolKey memory staticKey = PoolKey(currency0, currency1, 3000, 60, IHooks(hook));
        vm.expectRevert();
        poolManager.initialize(staticKey, Constants.SQRT_PRICE_1_1);
    }

    function test_badHookDataReverts() public {
        vm.expectRevert();
        swapRouter.swapExactTokensForTokens({
            amountIn: 1e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: bytes("xx"),
            receiver: address(this),
            deadline: block.timestamp + 1
        });
    }

    function test_unbondDelay() public {
        vm.startPrank(searcher);
        bonds.bond(5e18);
        bonds.queueUnbond(5e18);
        vm.expectRevert(SearcherBond.UnbondNotReady.selector);
        bonds.claimUnbond();
        vm.roll(block.number + 2);
        bonds.claimUnbond();
        vm.stopPrank();
        assertEq(bonds.bondedOf(searcher), 0);
    }
}
