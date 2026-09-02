import { useState } from "react";
import { useAppData } from "../context/AppData";
import { useToast } from "../context/Toast";
import { addresses, explorerTx, isLocal, isZero } from "../lib/clients";
import { incrementFlashblock, mine } from "../lib/actions";
import { short } from "../lib/format";

export function AttestationPage() {
  const { policy, signer, needsConnect, connect, refresh } = useAppData();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const fair = policy?.fairNow ?? false;
  const oracle = !isZero(addresses.oracle) ? addresses.oracle : addresses.policy;
  const configured = !isZero(oracle);

  async function pulse() {
    if (!signer) return;
    setBusy("incrementFlashblock…");
    try {
      const hash = await incrementFlashblock(signer.owner, signer.wc);
      if (isLocal) await mine(1);
      toast.ok("TEE builder heartbeat — flashblock incremented", explorerTx(hash));
      await refresh();
    } catch (e) {
      toast.err((e as Error).message.slice(0, 120));
    } finally {
      setBusy(null);
    }
  }

  async function advance(n: number) {
    setBusy(`Mining ${n} blocks…`);
    try {
      await mine(n);
      toast.info(`Mined ${n} blocks`);
      await refresh();
    } catch (e) {
      toast.err((e as Error).message.slice(0, 120));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <section className="card card-lg">
        <div className="card-head">
          <div>
            <h2>Attestation oracle</h2>
            <span className="muted">{configured ? short(oracle) : "not configured"}</span>
          </div>
        </div>

        <div className={`status-big ${fair ? "fair" : "toxic"}`}>
          <span className="sd" />
          <div>
            <strong>{fair ? "FAIR / TEE ACTIVE" : "UNATTESTED"}</strong>
            <small>
              {policy
                ? `current block ${policy.block.toString()} · fair until ${policy.fairUntilBlock.toString()}`
                : "reading oracle…"}
            </small>
          </div>
        </div>

        <p className="lead" style={{ fontSize: "0.9rem" }}>
          This is an owner-gated TEE builder heartbeat, not a mock fair window.
          Authorized builders call <code style={{ fontFamily: "var(--font-mono)" }}>incrementFlashblock()</code>{" "}
          with no duration argument. On a live Unichain feed the canonical
          FlashblockNumber contract is the source of truth.
        </p>

        {needsConnect ? (
          <button className="btn btn-primary btn-lg" style={{ marginTop: 8 }} onClick={connect}>
            Connect wallet
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <button className="btn btn-primary" disabled={!!busy || !configured} onClick={pulse}>
              {busy ?? "incrementFlashblock"}
            </button>
            {isLocal && (
              <button className="btn btn-outline" disabled={!!busy} onClick={() => advance(1)}>
                Mine 1 block
              </button>
            )}
          </div>
        )}
        {!configured && (
          <p className="fineprint">No oracle/policy address in deployed.json.</p>
        )}
      </section>

      <section className="card card-lg">
        <div className="card-head">
          <h2>Lifecycle</h2>
        </div>
        <ol className="steps">
          <li>
            TEE / seeded builders call <b>incrementFlashblock</b> (or the live
            Unichain feed advances).
          </li>
          <li>
            <b>beforeSwap</b> reads <code style={{ fontFamily: "var(--font-mono)" }}>isFair(block)</code>{" "}
            then classifies the corridor (attested / bonded slot / toxic).
          </li>
          <li>
            Bonded searchers pay slot fees; toxic flow pays 1% + 50 bps donate.
          </li>
          <li>
            <b>afterSwap</b> may slash 20% of the bond on a same-block opposite
            swap, then emits <code style={{ fontFamily: "var(--font-mono)" }}>SwapClassified</code>.
          </li>
        </ol>
      </section>
    </div>
  );
}
