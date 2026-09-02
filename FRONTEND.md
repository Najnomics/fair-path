# Frontend (Opus 4.8 / Claude Code)

This repo ships **production Solidity**. Do not add a mock UI. Build a Uniswap v4 SDK console the way Fair Flow did (`@uniswap/v4-sdk`, `Pool.getOutputAmount`, `V4PositionManager.addCallParameters`, StateView reads).

## Must prove on-chain

1. Attested corridor after a registered builder calls `UnichainFairOracle.incrementFlashblock` (or live Unichain `FlashblockNumber`).
2. Toxic corridor (no heartbeat, no bond) — LP recapture ticker.
3. Bonded slot corridor — `hookData = abi.encode(searcher)` after `SearcherBond.bond`.
4. Same-block opposite swap from that searcher — `BondSlashed` + donate.

## Stack

- Vite + React + wagmi + viem
- `@uniswap/v4-sdk` `@uniswap/sdk-core` `@uniswap/universal-router-sdk`
- Addresses from `deployments/unichain.json`
- Chain Unichain Sepolia 1301
- No AI voice in the demo video

Read `README.md` for corridor fees and events (`SwapClassified`, `BondSlashed`).
