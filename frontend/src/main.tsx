import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { isDeployed } from "./lib/clients";
import { AppDataProvider } from "./context/AppData";
import { ToastProvider } from "./context/Toast";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Overview } from "./pages/Overview";
import { NotDeployed } from "./pages/NotDeployed";
import { NotFound } from "./pages/NotFound";

const SwapPage = lazy(() =>
  import("./pages/SwapPage").then((m) => ({ default: m.SwapPage })),
);
const LiquidityPage = lazy(() =>
  import("./pages/LiquidityPage").then((m) => ({ default: m.LiquidityPage })),
);
const AnalyticsPage = lazy(() =>
  import("./pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })),
);
const AttestationPage = lazy(() =>
  import("./pages/AttestationPage").then((m) => ({ default: m.AttestationPage })),
);
const AboutPage = lazy(() =>
  import("./pages/AboutPage").then((m) => ({ default: m.AboutPage })),
);

function Root() {
  if (!isDeployed()) return <NotDeployed />;
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppDataProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="swap" element={<SwapPage />} />
                <Route path="liquidity" element={<LiquidityPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="attestation" element={<AttestationPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AppDataProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
