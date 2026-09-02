import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../context/AppData";
import { useToast } from "../context/Toast";
import { explorerTx, isLocal } from "../lib/clients";
import { faucet, incrementFlashblock, mine } from "../lib/actions";
import { compact, fmt, symbolFor } from "../lib/format";
import {
  IconBolt,
  IconChart,
  IconCoins,
  IconDrop,
  IconLock,
  IconShield,
  IconSwap,
} from "../components/icons";

export function Overview() {
  const { pool, recaptured, events, policy, ready } = useAppData();
  const attested = events.filter((e) => e.attested).length;
  const toxic = events.filter((e) => !e.attested).length;
  const taxCurrency = events.find((e) => e.taxAmount > 0n)?.taxCurrency;

  return (
    <div className="grid" style={{ gap: 22 }}>
      <section className="hero">
        <span className="hero-eyebrow">● UHI10 · Sustainable Liquidity & MEV Protection</span>
        <h1>
          Three corridors. One pool.{" "}
          <span className="grad">Tax toxic flow, rent first-look, attest the rest.</span>
        </h1>
        <p>
          Fair Path is a Uniswap v4 hook with three corridors on a single pool:
          attested TEE flow at retail fees, bonded searchers paying slot-priced
          first-look, and unbonded toxic flow taxed with a donate to in-range LPs.
          Same-block opposite swaps slash 20% of the bond.
        </p>
        <div className="hero-cta">
          <Link to="/swap" className="btn btn-primary">
            <IconSwap /> Try a swap
          </Link>
          <Link to="/analytics" className="btn btn-outline">
            <IconChart /> See the flow
          </Link>
          <Link to="/about" className="btn btn-outline">
            How it works
          </Link>
        </div>
        <svg className="hero-flow" viewBox="0 0 380 260">
          <path d="M0 200 C 90 200 90 80 190 80 S 290 200 380 200" stroke="#34e1a4" />
          <path d="M0 230 C 90 230 90 130 190 130 S 290 30 380 30" stroke="#7c8bff" />
          <path d="M0 160 C 90 160 90 40 190 40 S 290 160 380 160" stroke="#ff5f6d" opacity="0.6" />
        </svg>
      </section>

      <section className="grid cols-4">
        <Stat
          label="Recaptured for LPs"
          value={`${fmt(recaptured, 4)}`}
          sub={taxCurrency ? symbolFor(taxCurrency) : "donated via hook"}
          tone="fair"
          icon={<IconCoins />}
          loading={!ready}
        />
        <Stat
          label="Attested fills"
          value={String(attested)}
          sub="low retail fee"
          tone="fair"
          icon={<IconShield />}
          loading={!ready}
        />
        <Stat
          label="Toxic fills taxed"
          value={String(toxic)}
          sub="premium + recapture"
          tone="toxic"
          icon={<IconBolt />}
          loading={!ready}
        />
        <Stat
          label="Fair window"
          value={policy?.fairNow ? "OPEN" : "CLOSED"}
          sub={
            policy
              ? `block ${policy.block.toString()} / until ${policy.fairUntilBlock.toString()}`
              : "—"
          }
          tone={policy?.fairNow ? "fair" : undefined}
          icon={<IconLock />}
          loading={!ready}
        />
      </section>

      <QuickActions />

      <section className="grid cols-3">
        <Feature
          icon={<IconShield />}
          title="1 · Classify the corridor"
          body="beforeSwap reads the TEE oracle, then the searcher bond. Attested blocks get 5 bps. Bonded searchers pay a flashblock slot fee. Everyone else is toxic."
        />
        <Feature
          icon={<IconBolt />}
          title="2 · Price first-look"
          body="Bonded slot fees decay across flashblock slots. Unbonded flow pays 1% plus a 50 bps donate. Same-block opposite-direction swaps slash 20% of the bond to LPs."
        />
        <Feature
          icon={<IconCoins />}
          title="3 · Recapture to LPs"
          body="afterSwap donates toxic tax and slashed bond value to in-range LPs, then emits SwapClassified with corridor, slot, and tax."
        />
      </section>

      <section className="grid cols-2" style={{ alignItems: "start" }}>
        <ProblemSolution />
        <FeeSchedule />
      </section>

      <section className="card card-lg">
        <div className="card-head">
          <div>
            <h2>Live pool snapshot</h2>
            <span className="muted">read on-chain via v4 StateView</span>
          </div>
          <Link to="/liquidity" className="btn btn-ghost">
            Manage liquidity
          </Link>
        </div>
        <div className="grid cols-3">
          <MiniStat label="Tick" value={pool ? pool.tick.toString() : "—"} loading={!ready} />
          <MiniStat
            label="Active liquidity"
            value={pool ? compact(pool.liquidity) : "—"}
            loading={!ready}
          />
          <MiniStat
            label="Pool fee flag"
            value={pool ? (pool.lpFee === 0x800000 ? "dynamic" : `${pool.lpFee}`) : "—"}
            loading={!ready}
          />
        </div>
      </section>

      <Integrations />
      <Faq />
      <CtaBand />
    </div>
  );
}

function QuickActions() {
  const { signer, needsConnect, connect, policy, refresh } = useAppData();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<`0x${string}` | void>) {
    if (!signer) return;
    setBusy(label);
    try {
      const hash = await fn();
      if (isLocal) await mine(1);
      toast.ok(`${label} — done`, hash ? explorerTx(hash) : undefined);
      await refresh();
    } catch (e) {
      toast.err((e as Error).message.slice(0, 110));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card card-lg">
      <div className="card-head">
        <div>
          <h2>Quick actions</h2>
          <span className="muted">interact with the live hook right here</span>
        </div>
        <span className={`pill ${policy?.fairNow ? "fair" : "toxic"}`}>
          <span className="dot" /> {policy?.fairNow ? "fair window open" : "toxic pricing"}
        </span>
      </div>

      {needsConnect ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <p className="lead" style={{ fontSize: "0.9rem", margin: 0, flex: 1 }}>
            Connect a wallet on Unichain Sepolia to mint test tokens, pulse the
            TEE oracle, and swap.
          </p>
          <button className="btn btn-primary" onClick={connect}>
            Connect wallet
          </button>
        </div>
      ) : (
        <div className="quick-grid">
          {!isLocal && (
            <QuickCard
              icon={<IconCoins />}
              title="Get test tokens"
              body="Mint 10,000 ffVOL + ffUSD to your wallet."
              action="Faucet"
              busy={busy === "Minted test tokens"}
              disabled={!!busy}
              onClick={() =>
                run("Minted test tokens", () => faucet(signer!.owner, signer!.wc))
              }
            />
          )}
          <QuickCard
            icon={<IconShield />}
            title="Pulse TEE heartbeat"
            body="Owner-gated builder incrementFlashblock — not a mock fair window."
            action="incrementFlashblock"
            busy={busy === "TEE heartbeat"}
            disabled={!!busy}
            onClick={() =>
              run("TEE heartbeat", () =>
                incrementFlashblock(signer!.owner, signer!.wc),
              )
            }
          />
          <QuickCard
            icon={<IconSwap />}
            title="Swap through a corridor"
            body="Compare attested vs public pricing side by side."
            action="Go to Swap"
            to="/swap"
          />
          <QuickCard
            icon={<IconDrop />}
            title="Provide liquidity"
            body="Add full-range liquidity and earn recapture."
            action="Go to Liquidity"
            to="/liquidity"
          />
        </div>
      )}
    </section>
  );
}

function QuickCard({
  icon,
  title,
  body,
  action,
  onClick,
  to,
  busy,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: string;
  onClick?: () => void;
  to?: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="quick-card">
      <div className="fic">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {to ? (
        <Link to={to} className="btn btn-ghost" style={{ marginTop: "auto" }}>
          {action}
        </Link>
      ) : (
        <button
          className="btn btn-primary"
          style={{ marginTop: "auto" }}
          disabled={disabled}
          onClick={onClick}
        >
          {busy ? "Working…" : action}
        </button>
      )}
    </div>
  );
}

function ProblemSolution() {
  const rows = [
    ["A searcher sandwiches a retail swap", "Toxic corridor: 1.00% + 0.50% donate"],
    ["First-look inside a flashblock", "Bonded slot fees, decaying by slot"],
    ["LPs eat the adverse selection", "Tax and 20% same-block slash go to LPs"],
    ["Attested TEE sequencing", "5 bps, no tax — corridor 0"],
  ];
  return (
    <div className="card card-lg">
      <div className="card-head">
        <h2>The problem → Fair Path</h2>
      </div>
      <table className="maptable">
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a}>
              <td>{a}</td>
              <td>
                <b>{b}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeeSchedule() {
  return (
    <div className="card card-lg">
      <div className="card-head">
        <h2>Fee schedule</h2>
        <span className="muted">enforced by the hook</span>
      </div>
      <div className="corridors">
        <div className="corridor fair sel">
          <div className="corridor-top">
            <span className="corridor-title">Attested</span>
            <span className="tag fair">5 BPS</span>
          </div>
          <div className="corridor-fee">
            0.05% <small>swap fee</small>
          </div>
          <div className="corridor-foot">TEE / fair block. No tax.</div>
        </div>
        <div className="corridor sel">
          <div className="corridor-top">
            <span className="corridor-title">Bonded slot</span>
            <span className="tag">RENT</span>
          </div>
          <div className="corridor-fee">
            slot <small>first-look</small>
          </div>
          <div className="corridor-foot">0.80% → 0.075% by flashblock slot. Slash 20% on same-block opposite.</div>
        </div>
        <div className="corridor toxic sel">
          <div className="corridor-top">
            <span className="corridor-title">Toxic</span>
            <span className="tag toxic">TAXED</span>
          </div>
          <div className="corridor-fee">
            1.00% <small>swap fee</small>
          </div>
          <div className="corridor-foot">+0.50% donate to in-range LPs.</div>
        </div>
      </div>
      <p className="fineprint">
        Tuned live via the v4 dynamic-fee override — no pool redeploy to change tiers.
      </p>
    </div>
  );
}

function Integrations() {
  const items = [
    ["Uniswap v4", "PoolManager, dynamic fees, donate, StateView, PositionManager"],
    ["Flashbots Flashtestations", "Builder attestation source (production policy seam)"],
    ["Unichain", "BlockBuilderPolicy + the deployment target (Sepolia 1301)"],
    ["Permit2", "Token approvals for router and position manager"],
  ];
  return (
    <section className="card card-lg">
      <div className="card-head">
        <div>
          <h2>Built on</h2>
          <span className="muted">standards & partner integrations</span>
        </div>
      </div>
      <div className="grid cols-4">
        {items.map(([name, desc]) => (
          <div className="stat" key={name}>
            <span className="stat-value" style={{ fontSize: "1.05rem" }}>
              {name}
            </span>
            <span className="stat-sub">{desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const qa = [
    [
      "Is this a private mempool or dark pool?",
      "No. One public v4 pool, three corridors. The hook prices attested, bonded, and toxic flow differently — no hidden liquidity.",
    ],
    [
      "What stops someone faking attestation?",
      "incrementFlashblock is owner-gated TEE / builder heartbeat (or a live Unichain FlashblockNumber feed). It is not a permissionless mock window.",
    ],
    [
      "Where does the recaptured value go?",
      "Toxic tax and slashed bond value go to in-range LPs via donate() inside afterSwap.",
    ],
    [
      "Do the quotes match the chain?",
      "Quotes use the Uniswap v4 SDK against live pool state; the actual corridor is decided on-chain at execution. Retail swaps send empty hookData.",
    ],
  ];
  return (
    <section className="card card-lg">
      <div className="card-head">
        <h2>FAQ</h2>
      </div>
      <div className="faq">
        {qa.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="cta-band">
      <div>
        <h2>Tax toxic flow. Rent first-look. Attest the rest.</h2>
        <p>Run a retail swap, watch the corridor, then pulse the TEE heartbeat if you are a seeded builder.</p>
      </div>
      <div className="cta-actions">
        <Link to="/swap" className="btn btn-primary">
          Launch the swap console
        </Link>
        <a
          href="https://github.com/Najnomics/fair-path"
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline"
        >
          View source
        </a>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  icon,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "fair" | "toxic";
  icon?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="stat">
      <div className="stat-ic">{icon}</div>
      <span className="stat-label">{label}</span>
      {loading ? (
        <div className="skel" style={{ height: 30, width: "60%" }} />
      ) : (
        <span className={`stat-value ${tone ?? ""}`}>{value}</span>
      )}
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      {loading ? (
        <div className="skel" style={{ height: 24, width: "50%" }} />
      ) : (
        <span className="stat-value" style={{ fontSize: "1.2rem" }}>
          {value}
        </span>
      )}
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card feature">
      <div className="fic">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
