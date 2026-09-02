import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type Kind = "ok" | "err" | "info";
type Toast = { id: number; kind: Kind; msg: string; link?: string };

type Ctx = {
  push: (kind: Kind, msg: string, link?: string) => void;
  ok: (msg: string, link?: string) => void;
  err: (msg: string, link?: string) => void;
  info: (msg: string, link?: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Kind, msg: string, link?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, msg, link }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const value: Ctx = {
    push,
    ok: (m, link) => push("ok", m, link),
    err: (m, link) => push("err", m, link),
    info: (m, link) => push("info", m, link),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span>{t.msg}</span>
            {t.link && (
              <a href={t.link} target="_blank" rel="noreferrer" className="toast-link">
                View ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
