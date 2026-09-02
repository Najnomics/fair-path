import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { foundry, unichain, unichainSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import deployed from "../deployed.json";

const d = deployed as Record<string, string | number>;
const CHAIN_ID = Number(deployed.chainId);
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

function addr(key: string): Address {
  const v = d[key];
  return (typeof v === "string" && v.startsWith("0x") ? v : ZERO) as Address;
}

/** True for the local Anvil demo (uses the built-in dev signer). */
export const isLocal = CHAIN_ID === 31337;

const CHAINS: Record<number, Chain> = {
  31337: foundry,
  130: unichain,
  1301: unichainSepolia,
};
export const chain: Chain = CHAINS[CHAIN_ID] ?? foundry;

const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;

export const rpcUrl = isLocal
  ? typeof window !== "undefined"
    ? `${window.location.origin}/rpc`
    : "http://127.0.0.1:8546"
  : viteEnv?.VITE_RPC_URL || chain.rpcUrls.default.http[0];

/** Anvil account #0. Local demo only — never use on a live network. */
export const ANVIL_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

/** Local dev signer. On live chains, writes go through a connected wallet. */
export const account = privateKeyToAccount(ANVIL_KEY);

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

/**
 * Dedicated client for `eth_getLogs`. Managed RPCs (e.g. Alchemy free tier) cap
 * log queries to a tiny block range, so we route log scans to the chain's public
 * endpoint which accepts wider ranges. Falls back to the main RPC locally.
 */
export const logsRpcUrl = isLocal
  ? rpcUrl
  : chain.rpcUrls.default.http[0] ?? rpcUrl;

export const logsClient = createPublicClient({
  chain,
  transport: http(logsRpcUrl),
});

export const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl),
});

const policyOrOracle = addr("policy") !== ZERO ? addr("policy") : addr("oracle");
const oracleOrPolicy = addr("oracle") !== ZERO ? addr("oracle") : addr("policy");

export const addresses = {
  hook: addr("hook"),
  policy: policyOrOracle,
  oracle: oracleOrPolicy,
  bonds: addr("bonds"),
  relayer: addr("relayer"),
  swapRouter: addr("swapRouter"),
  stateView: addr("stateView"),
  positionManager: addr("positionManager"),
  permit2: addr("permit2") !== ZERO ? addr("permit2") : ("0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address),
  token0: addr("token0"),
  token1: addr("token1"),
  token0Symbol: String(d.token0Symbol ?? "TOKEN0"),
  token1Symbol: String(d.token1Symbol ?? "TOKEN1"),
  fee: BigInt(d.fee ?? 0),
  tickSpacing: Number(d.tickSpacing ?? 60),
};

export const chainId = CHAIN_ID;

/** Block the contracts were deployed at — lower bound for log scans. */
export const deployBlock = BigInt((d.deployBlock as number) ?? 0);

export const poolKey = {
  currency0: addresses.token0,
  currency1: addresses.token1,
  fee: Number(addresses.fee),
  tickSpacing: addresses.tickSpacing,
  hooks: addresses.hook,
} as const;

export function isDeployed(): boolean {
  return addresses.hook !== ZERO;
}

export function isZero(a: Address): boolean {
  return a === ZERO;
}

/** Block-explorer URL for a tx hash (undefined on local Anvil). */
export function explorerTx(hash: string): string | undefined {
  const base = chain.blockExplorers?.default?.url;
  return base ? `${base}/tx/${hash}` : undefined;
}

/** Block-explorer URL for an address (undefined on local Anvil). */
export function explorerAddress(addr_: string): string | undefined {
  const base = chain.blockExplorers?.default?.url;
  return base ? `${base}/address/${addr_}` : undefined;
}

export async function mineBlocks(count: number): Promise<Hex> {
  return publicClient.request({
    method: "anvil_mine" as never,
    params: [`0x${count.toString(16)}`, "0x0"] as never,
  });
}
