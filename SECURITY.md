# Security notes

## Fair Path / Sold Backrun / Surplus Sink

- Hook callbacks are PoolManager-only (`BaseHook`).
- `sender` is the router. Identity for bonds / fills is `hookData`.
- Dynamic fee flag is required (`afterInitialize` reverts otherwise).
- Recapture uses take → donate → settle. No `beforeSwapReturnDelta`.
- SearcherBond: only the hook may `slash`. Unbond is delayed.
- Sold Backrun bids are ERC-20 (`bidToken`), refunded to the previous bidder, donated on fill.
- Surplus Sink receipts are EIP-712, bound to `poolId`, burned after use. `creditSurplus` is relayer-only and pulls tokens with `safeTransferFrom`.
- `.env` is gitignored. Never commit keys.
