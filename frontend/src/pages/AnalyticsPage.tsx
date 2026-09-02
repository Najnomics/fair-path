import { useMemo } from "react";
import { formatUnits } from "viem";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { useAppData } from "../context/AppData";
import { fmt, short, symbolFor, feePct } from "../lib/format";

const FAIR = "#e3b06a";
const TOXIC = "#e24a32";

export function AnalyticsPage() {
  const { events, recaptured } = useAppData();

  const attested = events.filter((e) => e.attested);
  const toxic = events.filter((e) => !e.attested);
  const taxCurrency = events.find((e) => e.taxAmount > 0n)?.taxCurrency;

  const series = useMemo(() => {
    const asc = [...events].sort((a, b) =>
      a.block === b.block ? 0 : a.block < b.block ? -1 : 1,
    );
    let cum = 0;
    return asc.map((e, i) => {
      cum += Number(formatUnits(e.taxAmount, 18));
      return {
        i: i + 1,
        block: Number(e.block),
        recaptured: Number(cum.toFixed(6)),
        attested: e.attested ? 1 : 0,
      };
    });
  }, [events]);

  const split = [
    { name: "Attested", value: attested.length, color: FAIR },
    { name: "Toxic", value: toxic.length, color: TOXIC },
  ];
  const hasSplit = attested.length + toxic.length > 0;

  return (
    <div className="grid" style={{ gap: 22 }}>
      <section className="grid cols-3">
        <div className="stat">
          <span className="stat-label">Total recaptured</span>
          <span className="stat-value fair">{fmt(recaptured, 4)}</span>
          <span className="stat-sub">{taxCurrency ? symbolFor(taxCurrency) : "to LPs"}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Attested fills</span>
          <span className="stat-value fair">{attested.length}</span>
          <span className="stat-sub">low retail fee</span>
        </div>
        <div className="stat">
          <span className="stat-label">Toxic fills taxed</span>
          <span className="stat-value toxic">{toxic.length}</span>
          <span className="stat-sub">premium + recapture</span>
        </div>
      </section>

      <section className="grid cols-2" style={{ alignItems: "start" }}>
        <div className="card card-lg">
          <div className="card-head">
            <div>
              <h2>Cumulative recapture</h2>
              <span className="muted">value returned to LPs over time</span>
            </div>
          </div>
          {series.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FAIR} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={FAIR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="i"
                  stroke="#767d92"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#767d92" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v) => `Swap #${v}`}
                  formatter={(v) => [v as number, "recaptured"]}
                />
                <Area
                  type="monotone"
                  dataKey="recaptured"
                  stroke={FAIR}
                  strokeWidth={2}
                  fill="url(#rec)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-lg">
          <div className="card-head">
            <div>
              <h2>Flow composition</h2>
              <span className="muted">attested vs toxic fills</span>
            </div>
          </div>
          {!hasSplit ? (
            <EmptyChart />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={split}
                    dataKey="value"
                    innerRadius={54}
                    outerRadius={82}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {split.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Legend color={FAIR} label="Attested" value={attested.length} />
                <Legend color={TOXIC} label="Toxic" value={toxic.length} />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card card-lg">
        <div className="card-head">
          <div>
            <h2>Live flow tape</h2>
            <span className="muted">SwapClassified events, newest first</span>
          </div>
          <Link to="/swap" className="btn btn-ghost">
            Generate flow
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="empty">
            No swaps yet — run one from the Swap tab and it lands here on-chain.
          </p>
        ) : (
          <ul className="tape">
            {events.map((e) => (
              <li key={`${e.txHash}:${e.logIndex}`} className={`row ${e.attested ? "fair" : "toxic"}`}>
                <span className={`tag ${e.attested ? "fair" : "toxic"}`}>
                  {e.attested ? "ATTESTED" : "TOXIC"}
                </span>
                <span>{feePct(e.fee)}</span>
                <span className="row-tax">
                  {e.taxAmount > 0n
                    ? `+${fmt(e.taxAmount, 4)} ${symbolFor(e.taxCurrency)} → LPs`
                    : "no tax"}
                </span>
                <span className="row-mono">blk {e.block.toString()}</span>
                <span className="row-mono">{short(e.sender)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const tooltipStyle = {
  background: "#10131f",
  border: "1px solid #2e3547",
  borderRadius: 10,
  fontSize: 12,
  color: "#f2f4fa",
};

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
      <span style={{ color: "#aab0c2", fontSize: 13, minWidth: 66 }}>{label}</span>
      <b style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{value}</b>
    </div>
  );
}

function EmptyChart() {
  return (
    <div
      style={{ height: 220, display: "grid", placeItems: "center" }}
      className="empty"
    >
      Waiting for on-chain swaps…
    </div>
  );
}
