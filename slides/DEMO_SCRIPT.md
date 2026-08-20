# Fair Path — 5-Minute Demo Video Guide

A shot-by-shot script for a UHI10 submission video that combines the **pitch deck** and the **live web app**. Total runtime: **~5:00**.

- **Deck:** https://uhi10-fair-path-pitch.vercel.app — press `F` for fullscreen, `→` to advance, `S` for speaker notes
- **App:** https://uhi10-fair-path.vercel.app
- **Contracts (Unichain Sepolia, 1301):** FairPathHook `0xcC3E…10C4` — see the deployment slide

---

## 0. Before you hit record (15 min of prep)

**Recording setup**
- Tool: **OBS Studio** (free, best) or **QuickTime** (Cmd-Shift-5) or **Loom**.
- Record at **1920×1080**, 30fps. Use a decent mic; record voiceover live or add it after.
- Two things on screen: (A) the deck in fullscreen, (B) a **maximized browser window** with the app.
  - Easiest: record the **whole screen** and just switch between the two apps with `Cmd-Tab`.
  - Cleaner: use OBS **Scenes** — one scene = deck window, one scene = browser window — and cut between them.

**Browser / wallet prep (do this so you don't fumble on camera)**
1. Open the app, connect your wallet (or the demo signer) on **Unichain Sepolia**.
2. Go to the **Faucet** and mint **fpVOL / fpUSD** now, so you have balances ready.
3. Pre-check the **tape** loads `SwapClassified` / `BondSlashed` events.
4. Decide the hero path in advance:
   - **Toxic swap** first (unattested, unbonded — 1.00% + 0.50% donate).
   - Then **pulse** the builder / fair window so `isFair` can flip.
   - **Attested swap** second (0.05%, no tax).
   - Optional: show **bond** + a bonded slot fill if time.
5. **Zoom the browser to ~110–125%** (Cmd-+) so fonts read on video.
6. Close extra tabs/notifications; enable Do Not Disturb.

**Timing tip:** on-chain confirmations + the UI poller take a few seconds. Either (a) pause and let it settle, or (b) pre-run one of each corridor before recording so the tape already looks rich, then do one live swap on camera to prove it's real.

---

## 1. The 5-minute script

> Cut points are marked ✂️. Voiceover lines are in quotes — adapt to your voice.

### 0:00 – 0:20 · Deck slide 1 (Title) ✂️ show deck
> "This is **Fair Path** — a Uniswap v4 hook that prices a swap by who built the block, where it sits in the flashblock, and who posted a bond. It's live on Unichain Sepolia."

Advance to slide 2.

### 0:20 – 0:50 · Deck slides 2–3 (Problem → Insight)
> "MEV isn't magic — it's a pricing failure. Attestation-only can't tell a slot-0 searcher from retail. Delay punishes everyone. Size fees can't tell a searcher from a whale."

Advance to slide 3.
> "Our insight: charge an honest price for attested flow, rent first-look as a slot, and send a bill — or a slash — to everyone else. Same pool. Same liquidity."

### 0:50 – 1:20 · Deck slides 4–6 (How → Trust → Fees)
> "In `beforeSwap` we classify and override the fee. In `afterSwap` we recapture toxic flow with `donate`, or slash a bonded sandwich into the same sink."

Advance through the fee table.
> "Attested is 0.05%. Toxic is 1.00% plus a 0.50% tax. Bonded slot-0 is rented, not free. Honest flow is about 20× cheaper."

### 1:20 – 3:40 · LIVE APP (the core — spend the most time here) ✂️ cut to browser

**(1:20) Overview / Trade**
> "Here's the live desk — Uniswap v4 SDK against live pool state. Pair is fpVOL / fpUSD."

**(1:45) Toxic swap**
> "I'll swap with no attestation and no bond. The hook should price this as toxic — 1.00% — and donate a 0.50% tax to LPs."
- Enter an amount, swap, confirm.
- After it confirms: "Watch the tape — `SwapClassified` toxic, recapture into the pool."

**(2:30) Builders / pulse**
> "Now I'll pulse the builder feed so the next block can be attested — same path Unichain Flashblocks and Flashtestations would drive in production."
- Pulse / increment flashblock. Show fair / slot state.

**(3:00) Attested swap**
> "Same pool, same liquidity — attested corridor. 0.05%. No tax, because this isn't extracting from LPs."
- Swap. Show cheap fee in the tape.

**(3:20) Tape**
> "Every fill is classified on-chain. Nothing here the contract can't prove."

### 3:40 – 4:20 · Deck flywheel + Why UHI10 ✂️ cut back to deck
> "Toxic flow, slot rent, and slashes pay LPs. Yield rises, liquidity sticks, attested volume wants the cheap lane — a flywheel paid by searchers, not honest users."

> "That's both halves of UHI10: sustainable liquidity and MEV protection — defense plus recapture."

### 4:20 – 4:50 · Deployed
> "Hook, oracle, and SearcherBond are live on Unichain Sepolia. Open source. Try the desk yourself."

### 4:50 – 5:00 · Closing
> "Fair Path: toxic flow pays. Honest flow is cheap. Thanks for watching."

---

## 2. Quick shot list (for editing)

| Time | Source | Content |
|------|--------|---------|
| 0:00 | Deck | Title |
| 0:20 | Deck | Problem + Insight |
| 0:50 | Deck | How + trust + fee table |
| 1:20 | App | Trade / live reads |
| 1:45 | App | Toxic swap (1.00% + tax) |
| 2:30 | App | Pulse / attested window |
| 3:00 | App | Attested swap (0.05%) |
| 3:20 | App | Event tape |
| 3:40 | Deck | Flywheel + Why UHI10 |
| 4:20 | Deck | Deployed |
| 4:50 | Deck | Closing |

---

## 3. Pro tips

- **Rehearse once untimed, once timed.** The live section always runs long — trim your talking, not the demo.
- If a confirmation hangs on camera, **keep narrating the value** — don't go silent.
- Show **wallet network = Unichain Sepolia** at least once.
- Keep the mouse **slow and deliberate**.
- Export **1080p, H.264**. Aim for a file under ~200 MB.
- Lower-third: `uhi10-fair-path.vercel.app`
- Your voice only — UHI video rule is no AI voice.
