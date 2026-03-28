import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { cryptoAssets } from "@/data/cryptoData";

const SESSION_KEY = "aegis_account_session_v2";
const API_BASE = import.meta.env.VITE_MARKET_API_URL || "http://127.0.0.1:8010";

type Role = "admin" | "user";

type SessionData = {
  email: string;
  role: Role;
};

type Holding = {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
};

type PortfolioState = {
  startingCash: number;
  cash: number;
  holdings: Holding[];
};

type AccountStateResponse = {
  session: SessionData;
  portfolio: PortfolioState;
};

const parseAssetPrice = (rawPrice: string) => Number(rawPrice.replace(/\$/g, "").replace(/,/g, ""));

const loadSession = (): SessionData | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.email || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveSession = (sessionData: SessionData) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const fetchJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) {
    throw new Error(payload.detail || "Request failed.");
  }
  return payload as T;
};

const loginAccount = (email: string, password: string) =>
  fetchJson<AccountStateResponse>("/account/login", {
    method: "POST",
    body: JSON.stringify({ email: normalizeEmail(email), password: password.trim() }),
  });

const registerAccount = (email: string, password: string) =>
  fetchJson<AccountStateResponse>("/account/register", {
    method: "POST",
    body: JSON.stringify({ email: normalizeEmail(email), password: password.trim() }),
  });

const loadPortfolio = (email: string) =>
  fetchJson<PortfolioState>(`/account/portfolio?email=${encodeURIComponent(normalizeEmail(email))}`);

const Account = () => {
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const priceBySymbol = useMemo(() => {
    return Object.fromEntries(cryptoAssets.map((asset) => [asset.symbol, parseAssetPrice(asset.price)])) as Record<string, number>;
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const sessionData = loadSession();
      if (!sessionData) return;
      setSession(sessionData);
      setIsLoggedIn(true);
      try {
        const remotePortfolio = await loadPortfolio(sessionData.email);
        setPortfolio(remotePortfolio);
      } catch {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
        setIsLoggedIn(false);
      }
    };
    void restoreSession();
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please add both email and password.");
      return;
    }
    setIsBusy(true);
    setError("");
    try {
      const response = await loginAccount(email, password);
      saveSession(response.session);
      setSession(response.session);
      setPortfolio(response.portfolio);
      setIsLoggedIn(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Login failed.";
      setError(message);
    } finally {
      setIsBusy(false);
    }
  };

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please add both email and password.");
      return;
    }
    setIsBusy(true);
    setError("");
    try {
      const response = await registerAccount(email, password);
      saveSession(response.session);
      setSession(response.session);
      setPortfolio(response.portfolio);
      setIsLoggedIn(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Account creation failed.";
      setError(message);
    } finally {
      setIsBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setIsLoggedIn(false);
    setSession(null);
    setPortfolio(null);
    setPassword("");
    setError("");
  };

  const closeModal = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const marketValue = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.holdings.reduce((sum, holding) => sum + holding.quantity * (priceBySymbol[holding.symbol] || 0), 0);
  }, [portfolio, priceBySymbol]);

  const invested = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.holdings.reduce((sum, holding) => sum + holding.quantity * holding.avgPrice, 0);
  }, [portfolio]);

  const totalProfit = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.cash + marketValue - portfolio.startingCash;
  }, [portfolio, marketValue]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(49,212,255,0.14),transparent_34%),radial-gradient(circle_at_84%_80%,rgba(122,88,255,0.12),transparent_34%)]" />
      <button type="button" className="absolute inset-0 z-0 bg-background/70 backdrop-blur-sm" aria-label="Close account popup" onClick={closeModal} />
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-24 sm:px-6 md:px-10">
        {!isLoggedIn ? (
          <div className="glass-card relative w-full max-w-md rounded-3xl border border-white/20 p-6 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.85)] sm:p-8">
            <button type="button" onClick={closeModal} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground" aria-label="Close account popup">
              <X size={16} />
            </button>
            <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Account</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-3 text-sm text-muted-foreground">Sign in or create an account to continue to your dashboard.</p>
            <Link to="/" className="mt-4 inline-block rounded-xl border border-white/20 bg-white/[0.04] px-3 py-2 text-sm text-foreground transition hover:bg-white/[0.08]">
              Main menu
            </Link>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button type="button" onClick={() => { setAuthMode("login"); setError(""); }} className={`rounded-lg px-3 py-2 text-sm transition ${authMode === "login" ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Sign in
              </button>
              <button type="button" onClick={() => { setAuthMode("register"); setError(""); }} className={`rounded-lg px-3 py-2 text-sm transition ${authMode === "register" ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Create account
              </button>
            </div>

            <form onSubmit={authMode === "login" ? login : register} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Email</label>
                <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40" placeholder="you@aegisai.com" />
              </div>

              <div>
                <label htmlFor="password" className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Password</label>
                <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40" placeholder="Enter password" />
              </div>

              {error && <p className="text-sm text-red-300">{error}</p>}

              <button type="submit" disabled={isBusy} className="w-full rounded-xl border border-cyan-300/35 bg-gradient-to-r from-cyan-300/20 to-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:from-cyan-300/30 hover:to-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                {isBusy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">Quick demo login</p>
              <p className="mt-1 text-sm text-cyan-100">Email: admin@aegisai.com</p>
              <p className="text-sm text-cyan-100">Password: admin123</p>
            </div>
          </div>
        ) : (
          <div className="glass-card relative w-full max-w-5xl rounded-3xl p-6 sm:p-8">
            <button type="button" onClick={closeModal} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground" aria-label="Close account popup">
              <X size={16} />
            </button>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Account dashboard</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Virtual account</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Signed in as {session?.email ?? "user"} ({session?.role ?? "user"}). Portfolio is saved on the backend and loads across devices.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <Link to="/" className="rounded-lg border border-white/20 bg-white/[0.04] px-3 py-1.5 text-foreground transition hover:bg-white/[0.08]">
                    Main menu
                  </Link>
                  <Link to="/trade" className="rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 py-1.5 font-medium text-cyan-100 transition hover:bg-cyan-300/20">
                    Open trade desk
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start">
                <button type="button" onClick={logout} className="rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2 text-sm text-foreground transition hover:bg-white/[0.08]">
                  Log out
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Available cash</p>
                <p className="mt-2 text-2xl font-semibold">${portfolio?.cash.toLocaleString() ?? "--"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Money invested</p>
                <p className="mt-2 text-2xl font-semibold">${invested.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Open positions</p>
                <p className="mt-2 text-2xl font-semibold">{portfolio?.holdings.length ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Profit / loss</p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: totalProfit >= 0 ? "hsl(142 70% 50%)" : "hsl(0 70% 55%)" }}>
                  {totalProfit >= 0 ? "+" : "-"}${Math.abs(totalProfit).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Account statistics</p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">Performance snapshot</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Market value</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">${marketValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Total equity</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">${((portfolio?.cash ?? 0) + marketValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Portfolio positions</p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">Your holdings</h2>
                <div className="mt-4 space-y-2">
                  {portfolio?.holdings.length ? (
                    portfolio.holdings.map((holding) => {
                      const currentPrice = priceBySymbol[holding.symbol] || 0;
                      const pnl = (currentPrice - holding.avgPrice) * holding.quantity;
                      return (
                        <div key={holding.symbol} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{holding.symbol}</p>
                            <p className="text-xs font-medium" style={{ color: pnl >= 0 ? "hsl(142 70% 50%)" : "hsl(0 70% 55%)" }}>
                              {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Qty: {holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} - Avg: ${holding.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-muted-foreground">No positions yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default Account;
