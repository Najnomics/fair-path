import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { account, isDeployed } from "../lib/clients";
import {
  readBalances,
  readLastSwap,
  readPolicy,
  readPoolState,
  readSwapEvents,
  readTotalRecaptured,
  type Balances,
  type LastSwap,
  type PolicyState,
  type SwapEvent,
} from "../lib/actions";
import type { PoolState } from "../lib/sdk";
import { useSigner, type Signer } from "../lib/wallet";

type AppData = {
  deployed: boolean;
  ready: boolean;
  pool: PoolState | null;
  balances: Balances | null;
  policy: PolicyState | null;
  recaptured: bigint;
  lastSwap: LastSwap | null;
  events: SwapEvent[];
  owner: string;
  signer: Signer | null;
  needsConnect: boolean;
  connect: () => void;
  disconnect: () => void;
  walletError: string | null;
  refresh: () => Promise<void>;
  busy: string | null;
  setBusy: (s: string | null) => void;
};

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const deployed = isDeployed();
  const { signer, connect, disconnect, error: walletError, needsConnect } =
    useSigner();
  const owner = signer?.owner ?? account.address;

  const [ready, setReady] = useState(false);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [policy, setPolicy] = useState<PolicyState | null>(null);
  const [recaptured, setRecaptured] = useState<bigint>(0n);
  const [lastSwap, setLastSwap] = useState<LastSwap | null>(null);
  const [events, setEvents] = useState<SwapEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!deployed) return;
    // Update each field independently so one slow/failed RPC call (e.g. a
    // rate-limited log scan) never freezes the rest of the live dashboard.
    const [p, b, pol, rec, ls, ev] = await Promise.allSettled([
      readPoolState(),
      readBalances(owner as `0x${string}`),
      readPolicy(),
      readTotalRecaptured(),
      readLastSwap(),
      readSwapEvents(80),
    ]);
    if (p.status === "fulfilled") setPool(p.value);
    if (b.status === "fulfilled") setBalances(b.value);
    if (pol.status === "fulfilled") setPolicy(pol.value);
    if (rec.status === "fulfilled") setRecaptured(rec.value);
    if (ls.status === "fulfilled" && ls.value) setLastSwap(ls.value);
    if (ev.status === "fulfilled") setEvents(ev.value);
    setReady(true);
  }, [deployed, owner]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const value: AppData = {
    deployed,
    ready,
    pool,
    balances,
    policy,
    recaptured,
    lastSwap,
    events,
    owner,
    signer,
    needsConnect,
    connect,
    disconnect,
    walletError,
    refresh,
    busy,
    setBusy,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
