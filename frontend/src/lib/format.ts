import { formatUnits } from "viem";
import { addresses } from "./clients";

/** Format an 18-dp raw bigint to a fixed-precision human string. */
export function fmt(raw: bigint, decimals = 4): string {
  const n = Number(formatUnits(raw, 18));
  if (!Number.isFinite(n)) return "0";
  if (n !== 0 && Math.abs(n) < 1 / 10 ** decimals) return `~0`;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** Compact large numbers (e.g. liquidity) for display. */
export function compact(raw: bigint): string {
  const n = Number(formatUnits(raw, 18));
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
}

export function short(addr?: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function symbolFor(currency?: string): string {
  if (!currency) return "";
  const c = currency.toLowerCase();
  if (c === addresses.token0.toLowerCase()) return addresses.token0Symbol as string;
  if (c === addresses.token1.toLowerCase()) return addresses.token1Symbol as string;
  return "tokens";
}

export function feePct(pips: number): string {
  return `${(pips / 10_000).toFixed(2)}%`;
}
