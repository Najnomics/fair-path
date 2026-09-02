import JSBI from "jsbi";
import {
  Token,
  CurrencyAmount,
  Percent,
  Price,
  computePriceImpact,
} from "@uniswap/sdk-core";
import { Pool, Position, V4PositionManager } from "@uniswap/v4-sdk";
import {
  Tick,
  TickListDataProvider,
  nearestUsableTick,
  TickMath,
} from "@uniswap/v3-sdk";
import type { Address, Hex } from "viem";
import { addresses, chainId } from "./clients";
import { toPoolId } from "./poolId";

export const CHAIN_ID = chainId;
const ZERO_HOOK = "0x0000000000000000000000000000000000000000";

/** Fee tiers the FairFlow hook overrides to at runtime. */
export const ATTESTED_FEE = 500; // 0.05%
export const TOXIC_FEE = 10_000; // 1.00%
export const TOXIC_TAX_BIPS = 50; // 0.50% recaptured for LPs

export const token0 = new Token(
  CHAIN_ID,
  addresses.token0,
  18,
  addresses.token0Symbol,
);
export const token1 = new Token(
  CHAIN_ID,
  addresses.token1,
  18,
  addresses.token1Symbol,
);

/** Canonical v4 pool id for the live (dynamic-fee) hooked pool. */
export const POOL_ID = toPoolId({
  currency0: addresses.token0,
  currency1: addresses.token1,
  fee: Number(addresses.fee),
  tickSpacing: addresses.tickSpacing,
  hooks: addresses.hook,
}) as Hex;

export type PoolState = {
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  lpFee: number;
};

/**
 * Build a hookless SDK Pool used purely for local swap math. The live pool
 * carries a hook (so `getOutputAmount` refuses to run); we reproduce its state
 * with a concrete fee tier so the SDK's concentrated-liquidity math applies.
 */
function mathPool(fee: number, s: PoolState): Pool {
  const ts = addresses.tickSpacing;
  const minTick = nearestUsableTick(TickMath.MIN_TICK, ts);
  const maxTick = nearestUsableTick(TickMath.MAX_TICK, ts);
  const L = s.liquidity.toString();
  const ticks = [
    new Tick({ index: minTick, liquidityGross: L, liquidityNet: L }),
    new Tick({
      index: maxTick,
      liquidityGross: L,
      liquidityNet: JSBI.unaryMinus(JSBI.BigInt(L)).toString(),
    }),
  ];
  return new Pool(
    token0,
    token1,
    fee,
    ts,
    ZERO_HOOK,
    s.sqrtPriceX96.toString(),
    L,
    s.tick,
    new TickListDataProvider(ticks, ts),
  );
}

export type PathQuote = {
  amountOut: bigint; // raw out from pool math (pre hook tax)
  netOut: bigint; // what the trader actually keeps after any recapture tax
  recapture: bigint; // amount donated to LPs (0 on the attested path)
  feePips: number;
  executionPrice: string; // out per 1 in, human units
  priceImpactPct: string;
};

export type DualQuote = {
  inputSymbol: string;
  outputSymbol: string;
  toxic: PathQuote;
  attested: PathQuote;
  savings: bigint; // extra output the trader keeps on the attested path
};

function fmt(amount: CurrencyAmount<Token>, sig = 6): string {
  return amount.toSignificant(sig);
}

async function quotePath(
  fee: number,
  zeroForOne: boolean,
  amountInRaw: bigint,
  s: PoolState,
  taxBips: number,
): Promise<PathQuote> {
  const pool = mathPool(fee, s);
  const inputToken = zeroForOne ? token0 : token1;
  const inputAmount = CurrencyAmount.fromRawAmount(
    inputToken,
    amountInRaw.toString(),
  );
  const [outputAmount] = await pool.getOutputAmount(inputAmount);
  const out = BigInt(outputAmount.quotient.toString());
  const recapture = (out * BigInt(taxBips)) / 10_000n;
  const netOut = out - recapture;

  // Execution price = out per unit in, using human decimals (both 18dp here).
  const price = new Price(
    inputToken,
    zeroForOne ? token1 : token0,
    inputAmount.quotient,
    outputAmount.quotient,
  );

  // Price impact = deviation of execution price from the pool mid price.
  const impact = computePriceImpact(
    pool.priceOf(inputToken),
    inputAmount,
    outputAmount,
  );

  return {
    amountOut: out,
    netOut,
    recapture,
    feePips: fee,
    executionPrice: price.toSignificant(6),
    priceImpactPct: impact.toSignificant(3),
  };
}

/** Quote both corridors (public/toxic vs attested/fair) from one pool snapshot. */
export async function dualQuote(
  zeroForOne: boolean,
  amountInRaw: bigint,
  s: PoolState,
): Promise<DualQuote> {
  const [toxic, attested] = await Promise.all([
    quotePath(TOXIC_FEE, zeroForOne, amountInRaw, s, TOXIC_TAX_BIPS),
    quotePath(ATTESTED_FEE, zeroForOne, amountInRaw, s, 0),
  ]);
  return {
    inputSymbol: zeroForOne ? addresses.token0Symbol : addresses.token1Symbol,
    outputSymbol: zeroForOne ? addresses.token1Symbol : addresses.token0Symbol,
    toxic,
    attested,
    savings: attested.netOut - toxic.netOut,
  };
}

/** Human-readable mid price of the pool (output token per 1 input token). */
export function midPrice(zeroForOne: boolean, s: PoolState): string {
  const pool = mathPool(ATTESTED_FEE, s);
  const inputToken = zeroForOne ? token0 : token1;
  return pool.priceOf(inputToken).toSignificant(6);
}

/**
 * Build PositionManager multicall calldata to add full-range liquidity using
 * the v4 SDK. Permit2 allowances are pre-granted for the demo account.
 */
export function buildAddLiquidity(
  s: PoolState,
  amount0Raw: bigint,
  amount1Raw: bigint,
  recipient: Address,
): { calldata: Hex; value: bigint } {
  const ts = addresses.tickSpacing;
  const tickLower = nearestUsableTick(TickMath.MIN_TICK, ts);
  const tickUpper = nearestUsableTick(TickMath.MAX_TICK, ts);

  // Live hooked pool (dynamic fee flag) so PositionManager targets the right id.
  const pool = new Pool(
    token0,
    token1,
    Number(addresses.fee),
    ts,
    addresses.hook,
    s.sqrtPriceX96.toString(),
    s.liquidity.toString(),
    s.tick,
  );

  const position = Position.fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0: amount0Raw.toString(),
    amount1: amount1Raw.toString(),
    useFullPrecision: true,
  });

  const { calldata, value } = V4PositionManager.addCallParameters(position, {
    recipient,
    slippageTolerance: new Percent(50, 10_000),
    deadline: Math.floor(Date.now() / 1000 + 3600).toString(),
    hookData: "0x",
  });

  return { calldata: calldata as Hex, value: BigInt(value) };
}

export { fmt };
