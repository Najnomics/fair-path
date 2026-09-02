// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IUniswapV4Router04} from "hookmate/interfaces/router/IUniswapV4Router04.sol";

interface IMintable is IERC20 {
    function mint(address to, uint256 amount) external;
}

interface IOracle {
    function incrementFlashblock() external;
    function setBuilder(address builder, bool allowed) external;
}

interface IBond {
    function asset() external view returns (address);
    function minBond() external view returns (uint256);
    function bond(uint256 amount) external;
    function bondedOf(address a) external view returns (uint256);
}

/// @notice Same-block TEE pulse + corridor swaps so attested flow actually lands.
contract DeskRunner {
    IUniswapV4Router04 public immutable router;
    IOracle public immutable oracle;
    IBond public immutable bonds;
    PoolKey public key;

    constructor(IUniswapV4Router04 router_, IOracle oracle_, IBond bonds_, PoolKey memory key_) {
        router = router_;
        oracle = oracle_;
        bonds = bonds_;
        key = key_;
    }

    function arm(IMintable t0, IMintable t1, uint256 mintAmt) external {
        t0.mint(address(this), mintAmt);
        t1.mint(address(this), mintAmt);
        t0.approve(address(router), type(uint256).max);
        t1.approve(address(router), type(uint256).max);
        IMintable asset = IMintable(bonds.asset());
        asset.mint(address(this), mintAmt);
        asset.approve(address(bonds), type(uint256).max);
        if (bonds.bondedOf(address(this)) < bonds.minBond()) {
            bonds.bond(bonds.minBond());
        }
    }

    function burstAttested(uint256 n, uint256 amountIn) external {
        oracle.incrementFlashblock();
        _burst(n, amountIn, bytes(""));
    }

    function burstToxic(uint256 n, uint256 amountIn) external {
        _burst(n, amountIn, bytes(""));
    }

    function burstBonded(uint256 n, uint256 amountIn) external {
        _burst(n, amountIn, abi.encode(address(this)));
    }

    function _burst(uint256 n, uint256 amountIn, bytes memory hookData) internal {
        for (uint256 i; i < n; ++i) {
            router.swapExactTokensForTokens(
                amountIn, 0, i % 2 == 0, key, hookData, address(this), block.timestamp + 3600
            );
        }
    }
}

contract PopulateTrafficScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        string memory j = vm.readFile("frontend/src/deployed.json");
        address hook = vm.parseJsonAddress(j, ".hook");
        address oracle = vm.parseJsonAddress(j, ".oracle");
        address bonds = vm.parseJsonAddress(j, ".bonds");
        address router = vm.parseJsonAddress(j, ".swapRouter");
        address token0 = vm.parseJsonAddress(j, ".token0");
        address token1 = vm.parseJsonAddress(j, ".token1");

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });

        vm.startBroadcast(pk);
        DeskRunner runner = new DeskRunner(IUniswapV4Router04(payable(router)), IOracle(oracle), IBond(bonds), key);
        IOracle(oracle).setBuilder(address(runner), true);
        runner.arm(IMintable(token0), IMintable(token1), 200_000 ether);
        runner.burstAttested(6, 2 ether);
        runner.burstToxic(8, 3 ether);
        runner.burstBonded(6, 1 ether);
        runner.burstAttested(4, 1 ether);
        runner.burstToxic(6, 2 ether);
        vm.stopBroadcast();

        console2.log("DeskRunner", address(runner));
        console2.log("swaps landed via attested / toxic / bonded bursts");
    }
}
