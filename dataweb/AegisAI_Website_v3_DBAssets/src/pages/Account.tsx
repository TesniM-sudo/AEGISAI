import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { cryptoAssets } from "@/data/cryptoData";

const SESSION_KEY = "aegis_account_session_v1";
const USERS_KEY = "aegis_account_users_v1";
const PORTFOLIOS_KEY = "aegis_account_portfolios_v1";
const DEFAULT_ADMIN = { email: "admin@aegisai.com", password: "admin123", role: "admin" as const };

type AccountUser = {
  email: string;
  password: string;
  role: "admin" | "user";
};

type SessionData = {
  email: string;
  role: "admin" | "user";
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

type PortfolioMap = Record<string, PortfolioState>;

const parseAssetPrice = (rawPrice: string) => Number(rawPrice.replace(/\$/g, "").replace(/,/g, ""));

const loadUsers = (): AccountUser[] => {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AccountUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveUsers = (users: AccountUser[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const loadSession = (): SessionData | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  if (raw === "logged_in") return { email: DEFAULT_ADMIN.email, role: "admin" };
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

const loadPortfolios = (): PortfolioMap => {
  const raw = localStorage.getItem(PORTFOLIOS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PortfolioMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const savePortfolios = (portfolios: PortfolioMap) => {
  localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify(portfolios));
};

const getStartingCash = (role: SessionData["role"]) => (role === "admin" ? 100000 : 10000);

const Account = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [error, setError] = useState("");
  const [tradeError, setTradeError] = useState("");
  const [tradeNote, setTradeNote] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState(cryptoAssets[0].symbol);
  const [quantityInput, setQuantityInput] = useState("1");

  const priceBySymbol = useMemo(() => {
    return Object.fromEntries(
      cryptoAssets.map((asset) => [asset.symbol, parseAssetPrice(asset.price)])
    ) as Record<string, number>;
  }, []);

  const selectedAsset = useMemo(
    () => cryptoAssets.find((asset) => asset.symbol === selectedSymbol) ?? cryptoAssets[0],
    [selectedSymbol]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const symbolFromUrl = params.get("symbol");
    const sideFromUrl = params.get("side");

    if (symbolFromUrl && cryptoAssets.some((asset) => asset.symbol === symbolFromUrl)) {
      setSelectedSymbol(symbolFromUrl);
    }
    if (sideFromUrl === "buy" || sideFromUrl === "sell") {
      setTradeNote(`Ready to ${sideFromUrl.toUpperCase()} ${symbolFromUrl ?? selectedSymbol}.`);
      setTradeError("");
    }
  }, [location.search]);

  useEffect(() => {
    const users = loadUsers();
    if (!users.find((user) => user.email.toLowerCase() === DEFAULT_ADMIN.email)) {
      saveUsers([...users, DEFAULT_ADMIN]);
    }

    const sessionData = loadSession();
    if (!sessionData) return;
    setSession(sessionData);
    setIsLoggedIn(true);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !session) return;
    const key = session.email.toLowerCase();
    const allPortfolios = loadPortfolios();
    const existing = allPortfolios[key];
    if (existing) {
      setPortfolio(existing);
      return;
    }

    const created: PortfolioState = {
      startingCash: getStartingCash(session.role),
      cash: getStartingCash(session.role),
      holdings: [],
    };
    const nextPortfolios = { ...allPortfolios, [key]: created };
    savePortfolios(nextPortfolios);
    setPortfolio(created);
  }, [isLoggedIn, session]);

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please add both email and password.");
      return;
    }

    const users = loadUsers();
    const matchedUser = users.find(
      (user) => user.email.toLowerCase() === email.trim().toLowerCase() && user.password === password
    );
    if (!matchedUser) {
      setError("We couldn't find that account. Try the demo admin or create a new account.");
      return;
    }

    const nextSession: SessionData = { email: matchedUser.email, role: matchedUser.role };
    setError("");
    saveSession(nextSession);
    setSession(nextSession);
    setIsLoggedIn(true);
  };

  const register = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      setError("Please add both email and password.");
      return;
    }
    if (!normalizedEmail.includes("@")) {
      setError("Please use a valid email address.");
      return;
    }
    if (password.trim().length < 4) {
      setError("Password should be at least 4 characters long.");
      return;
    }

    const users = loadUsers();
    if (users.find((user) => user.email.toLowerCase() === normalizedEmail)) {
      setError("That email already exists. Please sign in instead.");
      return;
    }

    const newUser: AccountUser = { email: normalizedEmail, password: password.trim(), role: "user" };
    saveUsers([...users, newUser]);

    const nextSession: SessionData = { email: newUser.email, role: newUser.role };
    saveSession(nextSession);
    setSession(nextSession);
    setError("");
    setIsLoggedIn(true);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setIsLoggedIn(false);
    setSession(null);
    setPortfolio(null);
    setPassword("");
    setTradeError("");
    setTradeNote("");
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

  const savePortfolioForCurrentSession = (nextPortfolio: PortfolioState) => {
    if (!session) return;
    const allPortfolios = loadPortfolios();
    const key = session.email.toLowerCase();
    const nextPortfolios = { ...allPortfolios, [key]: nextPortfolio };
    savePortfolios(nextPortfolios);
    setPortfolio(nextPortfolio);
  };

  const handleTrade = (side: "buy" | "sell") => {
    if (!portfolio) return;
    const units = Number(quantityInput);
    if (!Number.isFinite(units) || units <= 0) {
      setTradeError("Please enter a valid quantity.");
      setTradeNote("");
      return;
    }

    const price = priceBySymbol[selectedSymbol];
    if (!price) {
      setTradeError("Price unavailable for this asset.");
      setTradeNote("");
      return;
    }

    const position = portfolio.holdings.find((holding) => holding.symbol === selectedSymbol);

    if (side === "buy") {
      const cost = units * price;
      if (cost > portfolio.cash) {
        setTradeError("Not enough cash for this order.");
        setTradeNote("");
        return;
      }

      const nextHoldings = [...portfolio.holdings];
      if (position) {
        const newQuantity = position.quantity + units;
        const newAvgPrice = (position.avgPrice * position.quantity + cost) / newQuantity;
        const index = nextHoldings.findIndex((holding) => holding.symbol === selectedSymbol);
        nextHoldings[index] = { ...position, quantity: newQuantity, avgPrice: newAvgPrice };
      } else {
        nextHoldings.push({
          symbol: selectedAsset.symbol,
          name: selectedAsset.name,
          quantity: units,
          avgPrice: price,
        });
      }

      const nextPortfolio: PortfolioState = {
        ...portfolio,
        cash: portfolio.cash - cost,
        holdings: nextHoldings,
      };
      savePortfolioForCurrentSession(nextPortfolio);
      setTradeError("");
      setTradeNote(`Bought ${units} ${selectedAsset.symbol} at $${price.toFixed(2)}.`);
      return;
    }

    if (!position || position.quantity < units) {
      setTradeError("You don't have enough units to sell.");
      setTradeNote("");
      return;
    }

    const proceeds = units * price;
    const remainingQuantity = position.quantity - units;
    const nextHoldings = portfolio.holdings
      .map((holding) =>
        holding.symbol === selectedSymbol
          ? { ...holding, quantity: remainingQuantity }
          : holding
      )
      .filter((holding) => holding.quantity > 0);

    const nextPortfolio: PortfolioState = {
      ...portfolio,
      cash: portfolio.cash + proceeds,
      holdings: nextHoldings,
    };
    savePortfolioForCurrentSession(nextPortfolio);
    setTradeError("");
    setTradeNote(`Sold ${units} ${selectedAsset.symbol} at $${price.toFixed(2)}.`);
  };

  const marketValue = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.holdings.reduce((sum, holding) => sum + holding.quantity * priceBySymbol[holding.symbol], 0);
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
      <button
        type="button"
        className="absolute inset-0 z-0 bg-background/70 backdrop-blur-sm"
        aria-label="Close account popup"
        onClick={closeModal}
      />
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-24 sm:px-6 md:px-10">
        {!isLoggedIn ? (
          <div className="glass-card relative w-full max-w-md rounded-3xl border border-white/20 p-6 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.85)] sm:p-8">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              aria-label="Close account popup"
            >
              <X size={16} />
            </button>
            <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Account</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-3 text-sm text-muted-foreground">Sign in or create an account to continue to your dashboard.</p>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                }}
                className={`rounded-lg px-3 py-2 text-sm transition ${authMode === "login" ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                }}
                className={`rounded-lg px-3 py-2 text-sm transition ${authMode === "register" ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={authMode === "login" ? login : register} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40"
                  placeholder="you@aegisai.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40"
                  placeholder="Enter password"
                />
              </div>

              {error && <p className="text-sm text-red-300">{error}</p>}

              <button
                type="submit"
                className="w-full rounded-xl border border-cyan-300/35 bg-gradient-to-r from-cyan-300/20 to-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:from-cyan-300/30 hover:to-cyan-500/20"
              >
                {authMode === "login" ? "Sign in" : "Create account"}
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
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              aria-label="Close account popup"
            >
              <X size={16} />
            </button>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Admin dashboard</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Virtual account</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Signed in as {session?.email ?? "user"} ({session?.role ?? "user"}). Admin starts with $100,000 test balance.
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2 text-sm text-foreground transition hover:bg-white/[0.08]"
              >
                Log out
              </button>
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
                <p
                  className="mt-2 text-2xl font-semibold"
                  style={{ color: totalProfit >= 0 ? "hsl(142 70% 50%)" : "hsl(0 70% 55%)" }}
                >
                  {totalProfit >= 0 ? "+" : "-"}${Math.abs(totalProfit).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Trade</p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">Buy or sell assets</h2>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="asset" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Asset
                    </label>
                    <select
                      id="asset"
                      value={selectedSymbol}
                      onChange={(event) => setSelectedSymbol(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40"
                    >
                      {cryptoAssets.map((asset) => (
                        <option key={asset.symbol} value={asset.symbol} className="bg-slate-900 text-foreground">
                          {asset.symbol} ({asset.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="quantity" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Quantity
                    </label>
                    <input
                      id="quantity"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={quantityInput}
                      onChange={(event) => setQuantityInput(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40"
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-muted-foreground">Current price: <span className="text-foreground">${priceBySymbol[selectedAsset.symbol].toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTrade("buy")}
                    className="rounded-xl border border-emerald-300/35 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/20"
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrade("sell")}
                    className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20"
                  >
                    Sell
                  </button>
                </div>

                {tradeError && <p className="mt-3 text-sm text-red-300">{tradeError}</p>}
                {tradeNote && <p className="mt-3 text-sm text-cyan-100">{tradeNote}</p>}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Portfolio positions</p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">Your holdings</h2>
                <div className="mt-4 space-y-2">
                  {portfolio?.holdings.length ? (
                    portfolio.holdings.map((holding) => {
                      const currentPrice = priceBySymbol[holding.symbol];
                      const pnl = (currentPrice - holding.avgPrice) * holding.quantity;
                      return (
                        <div key={holding.symbol} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{holding.symbol}</p>
                            <p
                              className="text-xs font-medium"
                              style={{ color: pnl >= 0 ? "hsl(142 70% 50%)" : "hsl(0 70% 55%)" }}
                            >
                              {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Qty: {holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} • Avg: ${holding.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-muted-foreground">
                      No positions yet. Start with a buy order.
                    </div>
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
