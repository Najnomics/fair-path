import { Suspense, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { addresses, chain, explorerTx, isLocal } from "../lib/clients";
import { useAppData } from "../context/AppData";
import { useToast } from "../context/Toast";
import { faucet } from "../lib/actions";
import { fmt, short } from "../lib/format";

const NAV = [
  { to: "/", label: "Desk", end: true },
  { to: "/swap", label: "Trade" },
  { to: "/liquidity", label: "Book" },
  { to: "/analytics", label: "Tape" },
  { to: "/attestation", label: "Builders" },
  { to: "/about", label: "Notes" },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="path-app">
      <header className="path-mast">
        <a className="path-mark" href="/">
          <span className="path-rule" />
          Fair Path
        </a>
        <button className="path-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          Menu
        </button>
        <nav className={`path-nav ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
          {NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "on" : "")}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="path-tools">
          <FaucetButton />
          <NetworkChip />
          <WalletChip />
        </div>
      </header>
      <main className="content">
        <Suspense fallback={<div className="skel" style={{ height: 240 }} />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="path-foot">
        <span>Fair Path · copper corridors on Uniswap v4</span>
        <a href={`https://sepolia.uniscan.xyz/address/${addresses.hook}`} target="_blank" rel="noreferrer">
          Hook
        </a>
        <a href="https://github.com/Najnomics/fair-path" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}

function FaucetButton() {
  const { signer, refresh } = useAppData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (isLocal || !signer) return null;
  return (
    <button
      className="btn btn-ghost"
      disabled={busy}
      onClick={async () => {
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
      }}
    >
      {busy ? "Minting…" : "Faucet"}
    </button>
  );
}

function NetworkChip() {
  return (
    <span className="chip">
      <span className={`net-dot ${isLocal ? "local" : ""}`} />
      {isLocal ? "Anvil" : chain.name}
    </span>
  );
}

function WalletChip() {
  const { signer, balances, connect, disconnect, needsConnect } = useAppData();
  if (needsConnect) {
    return (
      <button className="btn btn-primary" onClick={connect}>
        Connect
      </button>
    );
  }
  return (
    <span className="chip wallet-chip" onClick={isLocal ? undefined : disconnect}>
      {short(signer?.owner)}
      {balances && (
        <span className="bals">
          {fmt(balances.token0, 2)} {String(addresses.token0Symbol)}
        </span>
      )}
    </span>
  );
}
