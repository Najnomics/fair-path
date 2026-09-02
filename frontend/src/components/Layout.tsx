import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { addresses, chain, explorerTx, isLocal } from "../lib/clients";
import { useAppData } from "../context/AppData";
import { useToast } from "../context/Toast";
import { faucet } from "../lib/actions";
import { fmt, short } from "../lib/format";
import {
  IconBook,
  IconChart,
  IconDrop,
  IconGithub,
  IconHome,
  IconMenu,
  IconShield,
  IconSwap,
} from "./icons";

const NAV = [
  { to: "/", label: "Overview", icon: IconHome, end: true },
  { to: "/swap", label: "Swap", icon: IconSwap },
  { to: "/liquidity", label: "Liquidity", icon: IconDrop },
  { to: "/analytics", label: "Flow Analytics", icon: IconChart },
  { to: "/attestation", label: "Attestation", icon: IconShield },
  { to: "/about", label: "How it works", icon: IconBook },
];

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  "/": { eyebrow: "Dashboard", title: "Overview" },
  "/swap": { eyebrow: "Trade", title: "Swap through a corridor" },
  "/liquidity": { eyebrow: "Provide", title: "Liquidity & recapture" },
  "/analytics": { eyebrow: "Insights", title: "Flow analytics" },
  "/attestation": { eyebrow: "Oracle", title: "Attestation control" },
  "/about": { eyebrow: "Docs", title: "How Fair Path works" },
};

export function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const meta = TITLES[loc.pathname] ?? { eyebrow: "Fair Path", title: "" };

  return (
    <div className="shell">
      <div
        className={`scrim ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sb-brand">
          <div className="sb-logo" />
          <div className="sb-title">
            Fair Path
            <small>THREE-CORRIDOR MEV PRICING</small>
          </div>
        </div>

        <div className="sb-section">Console</div>
        <nav className="sb-nav" onClick={() => setOpen(false)}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sb-link ${isActive ? "active" : ""}`}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sb-foot">
          <a
            href="https://github.com/Najnomics/fair-path"
            target="_blank"
            rel="noreferrer"
            className="sb-link"
            style={{ padding: "8px 10px" }}
          >
            <IconGithub />
            Source
          </a>
          <span>UHI10 · Uniswap v4 Hookathon</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="btn btn-ghost menu-btn"
              style={{ padding: 9 }}
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              <IconMenu />
            </button>
            <div>
              <div className="page-eyebrow">{meta.eyebrow}</div>
              <div className="page-title">{meta.title}</div>
            </div>
          </div>
          <div className="topbar-right">
            <FaucetButton />
            <NetworkChip />
            <WalletChip />
          </div>
        </header>
        <main className="content">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo" />
          <div>
            <div className="footer-name">Fair Path</div>
            <p className="footer-tag">
              Three corridors, one Uniswap v4 pool. Tax toxic flow, rent first-look, attest the rest — recapture for LPs.
            </p>
            <span className={`footer-net`}>
              <span className={`net-dot ${isLocal ? "local" : ""}`} />
              {isLocal ? "Anvil · local" : `${chain.name} · chain ${chain.id}`}
            </span>
          </div>
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <h4>Console</h4>
            <NavLink to="/">Overview</NavLink>
            <NavLink to="/swap">Swap</NavLink>
            <NavLink to="/liquidity">Liquidity</NavLink>
            <NavLink to="/analytics">Flow Analytics</NavLink>
            <NavLink to="/attestation">Attestation</NavLink>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <NavLink to="/about">How it works</NavLink>
            <a href="https://github.com/Najnomics/fair-path" target="_blank" rel="noreferrer">
              Repository
            </a>
            <a href="https://github.com/Najnomics/fair-path" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="https://docs.uniswap.org/contracts/v4/overview" target="_blank" rel="noreferrer">
              Uniswap v4 docs
            </a>
            <a
              href={`https://sepolia.uniscan.xyz/address/${addresses.hook}`}
              target="_blank"
              rel="noreferrer"
            >
              Hook on Uniscan
            </a>
          </div>
          <div className="footer-col">
            <h4>Partners</h4>
            <a href="https://docs.flashbots.net/" target="_blank" rel="noreferrer">
              Flashbots Flashtestations
            </a>
            <a href="https://docs.unichain.org/" target="_blank" rel="noreferrer">
              Unichain
            </a>
            <span className="footer-muted">UHI10 Hookathon</span>
          </div>
        </div>
      </div>

      <div className="footer-bar">
        <span>© {year} Fair Path · MIT License</span>
        <span className="footer-muted">
          Built for UHI10 — Sustainable Liquidity & MEV Protection
        </span>
      </div>
    </footer>
  );
}

function PageFallback() {
  return (
    <div className="grid cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="card card-lg">
          <div className="skel" style={{ height: 26, width: "40%", marginBottom: 16 }} />
          <div className="skel" style={{ height: 180 }} />
        </div>
      ))}
    </div>
  );
}

function FaucetButton() {
  const { signer, refresh } = useAppData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (isLocal || !signer) return null;

  async function drip() {
    if (!signer) return;
    setBusy(true);
    try {
      const hash = await faucet(signer.owner, signer.wc);
      toast.ok("Minted 10,000 of each test token", explorerTx(hash));
      await refresh();
    } catch (e) {
      toast.err((e as Error).message.slice(0, 100));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-ghost" style={{ padding: "8px 12px" }} disabled={busy} onClick={drip}>
      {busy ? "Minting…" : "Faucet"}
    </button>
  );
}

function NetworkChip() {
  return (
    <span className="chip" title={`Chain ID ${chain.id}`}>
      <span className={`net-dot ${isLocal ? "local" : ""}`} />
      {isLocal ? "Anvil · local" : chain.name}
    </span>
  );
}

function WalletChip() {
  const { signer, balances, connect, disconnect, needsConnect } = useAppData();

  if (needsConnect) {
    return (
      <button className="btn btn-primary" onClick={connect}>
        Connect wallet
      </button>
    );
  }

  return (
    <span
      className="chip wallet-chip"
      onClick={isLocal ? undefined : disconnect}
      title={isLocal ? "Local dev signer" : "Click to disconnect"}
    >
      <span className="net-dot" />
      <span>
        {short(signer?.owner)}
        {balances && (
          <span className="bals">
            <span>
              {fmt(balances.token0, 2)} {String(addresses.token0Symbol)}
            </span>
            <span>
              {fmt(balances.token1, 2)} {String(addresses.token1Symbol)}
            </span>
          </span>
        )}
      </span>
    </span>
  );
}
