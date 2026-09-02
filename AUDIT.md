# Product + security audit (UHI10)

Ran against `src/` (not `lib/`). Fixes shipped in the same commit as this note.

## Product

Each repo is a distinct v4 hook (dynamic fee + afterSwap donate, no beforeSwapReturnDelta / NoOp rug):

| Product | Mechanism |
|---|---|
| Fair Path | TEE attested / bonded slot / toxic tax + same-block opposite slash |
| Sold Backrun | Retail mints a backrun right; bonded ERC-20 first-price bid; fill donates bid + surplus |
| Surplus Sink | TEE heartbeat or EIP-712 relayer receipt → private fee; public tax; relayer `creditSurplus` |

## Security findings fixed

1. **Dust bonds** got the bonded-slot corridor. Corridor 2 now requires `bondedOf >= minBond`. First `bond()` must meet `minBond`.
2. **`setHook(address(0))`** could disable slashing. Reverts `ZeroAddress`.
3. **Sold Backrun 64-byte `hookData`** decoded a fill with `searcher = 0`. Fills must be 96 bytes.
4. **Surplus Sink** expired receipts now revert `Expired` instead of a generic bad receipt (when decodable).
5. **Oracle `setBuilder(0)`** reverted.

## Residual (accepted)

- `hookData` searcher identity is not a signature (v4 `sender` is the router). Slash/bond is an explicit opt-in desk, not a cryptographic identity.
- Live `FlashblockNumber` `isFair` is “feed non-zero” (Unichain TEE sequencer), not per-block local heartbeat. Local/demo `isFair` is same-block as `incrementFlashblock`.
- Coverage: Foundry `via_ir` makes 100% line maps unreliable. Suites are unit + integration + Unichain Sepolia fork smoke + fuzz on tax.

## Tests

`forge test` — hook flows, bond ledger, oracle feeds, fork `chainid == 1301`.
