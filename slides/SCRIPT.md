# Fair Path — 5:00 demo script

Record in **your voice**. No AI voiceover. Open `slides/index.html` full screen (press `F`). Have [the live desk](https://uhi10-fair-path.vercel.app) and `src/FairPathHook.sol` ready in other windows.

| Time | Slide | What to say / show |
|---|---|---|
| 0:00–0:20 | 1 Title | “Fair Path. One Uniswap v4 pool, three corridors. Toxic flow pays LPs. Honest flow is cheap.” |
| 0:20–0:40 | 2 Judges | “UHI10 is sustainable liquidity and MEV protection. Judges want a real hook, a live UI, a partner seam, and recapture — not a delay gimmick.” |
| 0:40–1:05 | 3 Problem | “Attestation-only can’t see slot 0. Delay hooks punish everyone. Size fees can’t tell a searcher from a whale. We price fairness, slot, and bond together.” |
| 1:05–1:35 | 4–5 Idea / how | Walk the three corridors: 0.05% attested, slot schedule if bonded, 1% + 50 bps skim if toxic. Same-block opposite swap slashes 20% of the bond into donate.” |
| 1:35–2:40 | CUT TO DESK | Live site, **fpVOL/fpUSD**. Click Trade: swap 1. Show tape / last corridor. LP page if time. Builders: mention TEE pulse. Do **not** dwell on faucet.” |
| 2:40–3:50 | CUT TO CODE | `_classify` then `_beforeSwap` fee override, then `_afterSwap` recapture vs `_maybeSlash`. One sentence: sender is the router, searcher is 32-byte hookData.” |
| 3:50–4:20 | 9 Deploy | Hook `0xcC3E…10c4` on Unichain Sepolia. Shared PM/router/POSM. `forge test` units, invariants, fork.” |
| 4:20–4:50 | 10–11 Business | “LPs earn the flow that used to bleed them. Searchers rent slot 0. Protocol later takes a cut of tax/slash, never attested retail.” |
| 4:50–5:00 | 12 Close | Repo Najnomics/fair-path, live URL, one-liner again. Stop.” |

**If a tx is slow:** keep talking over the pending hash. Don’t dead-air.

**Don’t say:** this is the same as Fair Flow; we detect all MEV; we use FHE.
