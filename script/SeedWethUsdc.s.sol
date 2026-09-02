// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";

/// @notice New WETH/USDC mock pool on the already-mined hook. ~3000 USDC per WETH.
contract SeedWethUsdcScript is Script {
    uint128 constant SEED_LIQUIDITY = 5_000e18;
    uint256 constant MINT_AMOUNT = 2_000_000 ether;
    int24 constant TS = 60;
    int24 constant WETH_USDC_TICK = 80040;

    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        string memory j = vm.readFile("frontend/src/deployed.json");

        address hook = vm.parseJsonAddress(j, ".hook");
        address pm = vm.parseJsonAddress(j, ".poolManager");
        address posm = vm.parseJsonAddress(j, ".positionManager");
        address permit2 = vm.parseJsonAddress(j, ".permit2");
        address router = vm.parseJsonAddress(j, ".swapRouter");
        uint256 chainId = vm.parseJsonUint(j, ".chainId");

        vm.startBroadcast(pk);
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 18);
        bool wethIs0 = address(weth) < address(usdc);
        MockERC20 token0 = wethIs0 ? weth : usdc;
        MockERC20 token1 = wethIs0 ? usdc : weth;

        token0.mint(deployer, MINT_AMOUNT);
        token1.mint(deployer, MINT_AMOUNT);
        token0.approve(permit2, type(uint256).max);
        token1.approve(permit2, type(uint256).max);
        token0.approve(router, type(uint256).max);
        token1.approve(router, type(uint256).max);
        IPermit2(permit2).approve(address(token0), posm, type(uint160).max, type(uint48).max);
        IPermit2(permit2).approve(address(token1), posm, type(uint160).max, type(uint48).max);

        uint160 sqrtP = TickMath.getSqrtPriceAtTick(wethIs0 ? WETH_USDC_TICK : -WETH_USDC_TICK);
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TS,
            hooks: IHooks(hook)
        });
        IPoolManager(pm).initialize(poolKey, sqrtP);

        int24 tickLower = TickMath.minUsableTick(TS);
        int24 tickUpper = TickMath.maxUsableTick(TS);
        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtP, TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), SEED_LIQUIDITY
        );
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP), uint8(Actions.SWEEP)
        );
        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(
            poolKey, tickLower, tickUpper, SEED_LIQUIDITY, amount0Expected + 1, amount1Expected + 1, deployer, bytes("")
        );
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        params[2] = abi.encode(poolKey.currency0, deployer);
        params[3] = abi.encode(poolKey.currency1, deployer);
        IPositionManager(posm).modifyLiquidities(abi.encode(actions, params), block.timestamp + 3600);
        vm.stopBroadcast();

        string memory json = string.concat(
            "{\n",
            '  "chainId": ', vm.toString(chainId), ",\n",
            '  "deployBlock": ', vm.toString(block.number), ",\n",
            '  "hook": "', vm.toString(hook), '",\n',
            '  "oracle": "', vm.toString(vm.parseJsonAddress(j, ".oracle")), '",\n',
            '  "policy": "', vm.toString(vm.parseJsonAddress(j, ".policy")), '",\n',
            '  "bonds": "', vm.toString(vm.parseJsonAddress(j, ".bonds")), '",\n',
            '  "poolManager": "', vm.toString(pm), '",\n',
            '  "swapRouter": "', vm.toString(router), '",\n',
            '  "positionManager": "', vm.toString(posm), '",\n',
            '  "permit2": "', vm.toString(permit2), '",\n',
            '  "stateView": "', vm.toString(vm.parseJsonAddress(j, ".stateView")), '",\n',
            '  "token0": "', vm.toString(address(token0)), '",\n',
            '  "token1": "', vm.toString(address(token1)), '",\n',
            '  "token0Symbol": "', token0.symbol(), '",\n',
            '  "token1Symbol": "', token1.symbol(), '",\n',
            '  "fee": 8388608,\n',
            '  "tickSpacing": 60,\n',
            '  "agent": "', vm.toString(vm.parseJsonAddress(j, ".agent")), '"\n',
            "}\n"
        );
        vm.writeFile("deployments/unichain.json", json);
        vm.writeFile("frontend/src/deployed.json", json);
        console2.log("token0", address(token0), token0.symbol());
        console2.log("token1", address(token1), token1.symbol());
    }
}
