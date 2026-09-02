import { useState } from "react";
import { parseUnits } from "viem";
import { useAppData } from "../context/AppData";
import { useToast } from "../context/Toast";
import { addresses, explorerTx, isLocal } from "../lib/clients";
import { buildAddLiquidity } from "../lib/sdk";
import { addLiquidity, mine } from "../lib/actions";
import { compact, fmt, symbolFor } from "../lib/format";

export function LiquidityPage() {
  const { pool, balances, recaptured, events, signer, needsConnect, connect, refresh } =
    useAppData();
  const toast = useToast();

  const [amt0, setAmt0] = useState("500");
  const [amt1, setAmt1] = useState("500");
  const [busy, setBusy] = useState<string | null>(null);

  const taxCurrency = events.find((e) => e.taxAmount > 0n)?.taxCurrency;

  async function add() {
    if (!signer || !pool) return;
    setBusy("Building position calldata…");
    try {
      const a0 = parseUnits(amt0 || "0", 18);
      const a1 = parseUnits(amt1 || "0", 18);
      const { calldata, value } = buildAddLiquidity(pool, a0, a1, signer.owner);
      setBusy("Adding liquidity…");
      const hash = await addLiquidity(calldata, value, signer.owner, signer.wc);
      if (isLocal) await mine(1);
      toast.ok("Liquidity added — full-range position minted", explorerTx(hash));
      await refresh();
    } catch (e) {
      toast.err((e as Error).message.slice(0, 120));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <section className="grid" style={{ gap: 18 }}>
        <div className="card card-lg">
          <div className="card-head">
            <div>
              <h2>Recaptured to LPs</h2>
              <span className="muted">totalTaxDonated · toxic donate + slash</span>
            </div>
          </div>
          <div className="stat" style={{ background: "transparent", border: 0, padding: 0 }}>
            <span className="stat-value fair" style={{ fontSize: "2.6rem" }}>
              {fmt(recaptured, 4)}
            </span>
            <span className="stat-sub">
              {taxCurrency ? symbolFor(taxCurrency) : "donated to in-range LPs"} — value
              that would otherwise have leaked to searchers.
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Pool state</h3>
            <span className="muted">v4 StateView</span>
          </div>
          <div className="grid cols-2">
            <Mini label="Current tick" value={pool ? pool.tick.toString() : "—"} />
            <Mini label="Active liquidity" value={pool ? compact(pool.liquidity) : "—"} />
            <Mini
              label="Fee mode"
              value={pool ? (pool.lpFee === 0x800000 ? "dynamic" : String(pool.lpFee)) : "—"}
            />
            <Mini
              label="Pair"
              value={`${String(addresses.token0Symbol)} / ${String(addresses.token1Symbol)}`}
            />
          </div>
        </div>
      </section>

      <section className="card card-lg">
        <div className="card-head">
          <div>
            <h2>Add liquidity</h2>
            <span className="muted">full-range · built with the v4 SDK PositionManager</span>
          </div>
        </div>

        <div className="io">
          <label>{String(addresses.token0Symbol)} amount</label>
          <div className="io-row">
            <input
              inputMode="decimal"
              value={amt0}
              onChange={(e) => setAmt0(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <span className="token-badge">
              <span className="tok-dot" /> {String(addresses.token0Symbol)}
            </span>
          </div>
          <div className="io-sub">
            <span>Balance: {balances ? fmt(balances.token0, 4) : "—"}</span>
          </div>
        </div>

        <div className="io" style={{ marginTop: 12 }}>
          <label>{String(addresses.token1Symbol)} amount</label>
          <div className="io-row">
            <input
              inputMode="decimal"
              value={amt1}
              onChange={(e) => setAmt1(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <span className="token-badge">
              <span className="tok-dot" /> {String(addresses.token1Symbol)}
            </span>
          </div>
          <div className="io-sub">
            <span>Balance: {balances ? fmt(balances.token1, 4) : "—"}</span>
          </div>
        </div>

        {needsConnect ? (
          <button className="btn btn-primary btn-lg" style={{ marginTop: 16 }} onClick={connect}>
            Connect wallet
          </button>
        ) : (
          <button
            className="btn btn-primary btn-lg"
            style={{ marginTop: 16 }}
            disabled={!pool || !!busy}
            onClick={add}
          >
            {busy ?? "Add full-range liquidity"}
          </button>
        )}
        <p className="fineprint">
          The SDK computes optimal amounts for the range and encodes a
          PositionManager multicall. {isLocal
            ? "Permit2 allowances are pre-granted for the local demo account."
            : "Ensure Permit2 allowances are granted for the pool tokens on this network."}
        </p>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ fontSize: "1.15rem" }}>
        {value}
      </span>
    </div>
  );
}
