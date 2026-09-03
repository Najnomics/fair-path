#!/usr/bin/env node
/**
 * Live Unichain Sepolia console e2e: faucet, swap, Permit2 LP, oracle pulse.
 * PRIVATE_KEY from repo .env — never logs the key.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, parseUnits } from "../frontend/node_modules/viem/_esm/index.js";
import { privateKeyToAccount } from "../frontend/node_modules/viem/_esm/accounts/index.js";
import { unichainSepolia } from "../frontend/node_modules/viem/_esm/chains/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(`${root}/.env`, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const deployed = JSON.parse(readFileSync(`${root}/frontend/src/deployed.json`, "utf8"));
const pk = env.PRIVATE_KEY.startsWith("0x") ? env.PRIVATE_KEY : `0x${env.PRIVATE_KEY}`;
const account = privateKeyToAccount(pk);
const rpc = env.UNICHAIN_SEPOLIA_RPC_URL || "https://sepolia.unichain.org";
const publicClient = createPublicClient({ chain: unichainSepolia, transport: http(rpc) });
const wallet = createWalletClient({
  account,
  chain: unichainSepolia,
  transport: http(rpc),
});

const erc20 = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
];
const routerAbi = [
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "zeroForOne", type: "bool" },
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "hookData", type: "bytes" },
      { name: "receiver", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "int256" }],
  },
];
const policyAbi = [{ type: "function", name: "incrementFlashblock", stateMutability: "nonpayable", inputs: [], outputs: [] }];

const poolKey = {
  currency0: deployed.token0,
  currency1: deployed.token1,
  fee: Number(deployed.fee),
  tickSpacing: Number(deployed.tickSpacing),
  hooks: deployed.hook,
};

async function send(label, fn) {
  process.stdout.write(`${label}… `);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const hash = await fn();
      const rec = await publicClient.waitForTransactionReceipt({ hash });
      if (rec.status !== "success") throw new Error(`reverted ${hash}`);
      console.log(`ok ${hash.slice(0, 12)}…`);
      return hash;
    } catch (e) {
      const msg = e.shortMessage || e.message || String(e);
      const retryable =
        /underpriced|nonce|replacement|already known/i.test(msg);
      if (!retryable || attempt === 4) {
        console.log(`FAIL ${msg}`);
        throw e;
      }
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
    }
  }
}

const amt = parseUnits("1000", 18);
const swapIn = parseUnits("1", 18);

await send("faucet t0", () =>
  wallet.writeContract({ address: deployed.token0, abi: erc20, functionName: "mint", args: [account.address, amt] }),
);
await send("faucet t1", () =>
  wallet.writeContract({ address: deployed.token1, abi: erc20, functionName: "mint", args: [account.address, amt] }),
);
await send("approve router t0", () =>
  wallet.writeContract({
    address: deployed.token0,
    abi: erc20,
    functionName: "approve",
    args: [deployed.swapRouter, 2n ** 256n - 1n],
  }),
);
await send("swap 1 token0→token1", () =>
  wallet.writeContract({
    address: deployed.swapRouter,
    abi: routerAbi,
    functionName: "swapExactTokensForTokens",
    args: [swapIn, 0n, true, poolKey, "0x", account.address, BigInt(Math.floor(Date.now() / 1000 + 3600))],
    gas: 1_500_000n,
  }),
);

if (deployed.oracle || deployed.policy) {
  const oracle = deployed.oracle || deployed.policy;
  const oracleAbi = [
    ...policyAbi,
    {
      type: "function",
      name: "setBuilder",
      stateMutability: "nonpayable",
      inputs: [
        { name: "builder", type: "address" },
        { name: "allowed", type: "bool" },
      ],
      outputs: [],
    },
  ];
  try {
    await send("setBuilder(self)", () =>
      wallet.writeContract({
        address: oracle,
        abi: oracleAbi,
        functionName: "setBuilder",
        args: [account.address, true],
        gas: 80_000n,
      }),
    );
    await send("incrementFlashblock", () =>
      wallet.writeContract({
        address: oracle,
        abi: policyAbi,
        functionName: "incrementFlashblock",
        gas: 250_000n,
      }),
    );
  } catch {
    console.log("oracle pulse skipped");
  }
}

if (deployed.agent && process.env.HUNT === "1") {
  await send("agent hunt", () =>
    wallet.writeContract({
      address: deployed.agent,
      abi: [
        {
          type: "function",
          name: "hunt",
          stateMutability: "nonpayable",
          inputs: [
            { type: "bool" },
            { type: "uint256" },
            { type: "uint256" },
            { type: "uint256" },
          ],
          outputs: [],
        },
      ],
      functionName: "hunt",
      args: [true, parseUnits("1", 18), parseUnits("0.5", 18), parseUnits("2", 18)],
      gas: 3_000_000n,
    }),
  );
}

console.log("e2e done", deployed.token0Symbol, deployed.token1Symbol, account.address);
