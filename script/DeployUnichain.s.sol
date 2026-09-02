// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {StateView} from "@uniswap/v4-periphery/src/lens/StateView.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";

import {Deployers} from "../test/utils/Deployers.sol";
import {FairPathHook} from "../src/FairPathHook.sol";
import {UnichainFairOracle} from "../src/UnichainFairOracle.sol";
import {SearcherBond} from "../src/SearcherBond.sol";

contract DeployUnichainScript is Script, Deployers {
    uint128 constant SEED_LIQUIDITY = 1_000e18;
    uint256 constant MINT_AMOUNT = 1_000_000 ether;

    function _etch(address, bytes memory) internal pure override {
        revert("etch unsupported on live networks");
    }

    function run() public {
        uint256 chainId = block.chainid;
        require(chainId == 130 || chainId == 1301, "use Unichain (130) or Unichain Sepolia (1301)");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address fb = vm.envOr("FLASHBLOCK_NUMBER", address(0));
        address policyAddr = vm.envOr("BLOCK_BUILDER_POLICY", address(0));

        vm.startBroadcast(pk);
        deployPermit2();
        deployPoolManager();
        deployPositionManager();
        deployRouter();
        StateView stateView = new StateView(poolManager);

        (MockERC20 usd, MockERC20 vol) = _fundPair(deployer);
        UnichainFairOracle oracle = new UnichainFairOracle(deployer, fb, policyAddr);
        SearcherBond bonds = new SearcherBond(deployer, IERC20(address(usd)), 1 ether, 2);
        FairPathHook hook = _deployHook(oracle, bonds);
        bonds.setHook(address(hook));
        _seedPool(hook, usd, vol, deployer);
        vm.stopBroadcast();

        _writeManifest(chainId, hook, oracle, bonds, usd, vol, stateView);
    }

    function _fundPair(address deployer) internal returns (MockERC20 usd, MockERC20 vol) {
        usd = new MockERC20("Fair Path USD", "fpUSD", 18);
        vol = new MockERC20("Fair Path VOL", "fpVOL", 18);
        if (address(usd) > address(vol)) (usd, vol) = (vol, usd);
        usd.mint(deployer, MINT_AMOUNT);
        vol.mint(deployer, MINT_AMOUNT);
        usd.approve(address(permit2), type(uint256).max);
        vol.approve(address(permit2), type(uint256).max);
        usd.approve(address(swapRouter), type(uint256).max);
        vol.approve(address(swapRouter), type(uint256).max);
        permit2.approve(address(usd), address(positionManager), type(uint160).max, type(uint48).max);
        permit2.approve(address(vol), address(positionManager), type(uint160).max, type(uint48).max);
    }

    function _deployHook(UnichainFairOracle oracle, SearcherBond bonds) internal returns (FairPathHook hook) {
        uint160 flags = uint160(
            Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory constructorArgs = abi.encode(poolManager, oracle, oracle, bonds);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(FairPathHook).creationCode, constructorArgs);
        hook = new FairPathHook{salt: salt}(poolManager, oracle, oracle, bonds);
        require(address(hook) == hookAddress, "hook address mismatch");
    }

    function _seedPool(FairPathHook hook, MockERC20 usd, MockERC20 vol, address deployer) internal {
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(usd)),
            currency1: Currency.wrap(address(vol)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);
        int24 tickLower = TickMath.minUsableTick(60);
        int24 tickUpper = TickMath.maxUsableTick(60);
        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            SEED_LIQUIDITY
        );
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP), uint8(Actions.SWEEP)
        );
        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(
            poolKey, tickLower, tickUpper, SEED_LIQUIDITY, amount0Expected + 1, amount1Expected + 1, deployer, Constants.ZERO_BYTES
        );
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        params[2] = abi.encode(poolKey.currency0, deployer);
        params[3] = abi.encode(poolKey.currency1, deployer);
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp + 3600);
    }

    function _writeManifest(
        uint256 chainId,
        FairPathHook hook,
        UnichainFairOracle oracle,
        SearcherBond bonds,
        MockERC20 usd,
        MockERC20 vol,
        StateView stateView
    ) internal {
        string memory json = string.concat(
            "{\n",
            '  "chainId": ', vm.toString(chainId), ",\n",
            '  "deployBlock": ', vm.toString(block.number), ",\n",
            '  "hook": "', vm.toString(address(hook)), '",\n',
            '  "oracle": "', vm.toString(address(oracle)), '",\n',
            '  "policy": "', vm.toString(address(oracle)), '",\n',
            '  "bonds": "', vm.toString(address(bonds)), '",\n',
            '  "poolManager": "', vm.toString(address(poolManager)), '",\n',
            '  "swapRouter": "', vm.toString(address(swapRouter)), '",\n',
            '  "positionManager": "', vm.toString(address(positionManager)), '",\n',
            '  "permit2": "', vm.toString(address(permit2)), '",\n',
            '  "stateView": "', vm.toString(address(stateView)), '",\n',
            '  "token0": "', vm.toString(address(usd)), '",\n',
            '  "token1": "', vm.toString(address(vol)), '",\n',
            '  "token0Symbol": "', usd.symbol(), '",\n',
            '  "token1Symbol": "', vol.symbol(), '",\n',
            '  "fee": 8388608,\n',
            '  "tickSpacing": 60\n',
            "}\n"
        );
        vm.writeFile("deployments/unichain.json", json);
        vm.writeFile("frontend/src/deployed.json", json);
        console2.log("hook", address(hook));
    }
}
