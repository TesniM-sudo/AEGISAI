import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cryptoAssets } from "@/data/cryptoData";
import CandlestickChart, { type Candle } from "@/components/CandlestickChart";
import { fetchCandles } from "@/lib/marketApi";
import { getApiBase } from "@/lib/apiBase";

const SESSION_KEY = "aegis_account_session_v2";
const API_BASE = getApiBase();

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

type TradeSide = "buy" | "sell";

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

const loadPortfolio = (email: string) =>
  fetchJson<PortfolioState>(`/account/portfolio?email=${encodeURIComponent(normalizeEmail(email))}`);

const savePortfolio = (email: string, portfolio: PortfolioState) =>
  fetchJson<PortfolioState>("/account/portfolio", {
    method: "POST",
    body: JSON.stringify({ email: normalizeEmail(email), portfolio }),
  });

const parseAssetPrice = (rawPrice: string) => Number(rawPrice.replace(/\$/g, "").replace(/,/g, ""));

const Trade = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = loadSession();

  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState(cryptoAssets[0]?.symbol ?? "AAPL");
  const [side, setSide] = useState<TradeSide>("buy");
  const [quantity, setQuantity] = useState("");
  const [tradeMessage, setTradeMessage] = useState("");
  const [tradeError, setTradeError] = useState("");
  const [isTrading, setIsTrading] = useState(false);
  const [timeframe, setTimeframe] = useState<"1W" | "1M" | "3M" | "1Y">("1M");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState(false);
  const [candleError, setCandleError] = useState("");

  const priceBySymbol = useMemo(() => {
    return Object.fromEntries(cryptoAssets.map((asset) => [asset.symbol, parseAssetPrice(asset.price)])) as Record<string, number>;
  }, []);
  const nameBySymbol = useMemo(() => {
    return Object.fromEntries(cryptoAssets.map((asset) => [asset.symbol, asset.name])) as Record<string, string>;
  }, []);
  const colorBySymbol = useMemo(() => {
    return Object.fromEntries(cryptoAssets.map((asset) => [asset.symbol, asset.color])) as Record<string, string>;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const symbolParam = params.get("symbol");
    const sideParam = params.get("side");
    if (symbolParam && priceBySymbol[symbolParam]) {
      setSelectedSymbol(symbolParam);
    }
    if (sideParam === "buy" || sideParam === "sell") {
      setSide(sideParam);
    }
  }, [location.search, priceBySymbol]);

  useEffect(() => {
    const hydrate = async () => {
      if (!session) {
        setIsLoading(false);
        return;
      }
      try {
        const next = await loadPortfolio(session.email);
        setPortfolio(next);
      } catch (error) {
        setTradeError(error instanceof Error ? error.message : "Could not load portfolio.");
      } finally {
        setIsLoading(false);
      }
    };
    void hydrate();
  }, [session]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoadingCandles(true);
      setCandleError("");
      const limit = timeframe === "1W" ? 14 : timeframe === "1M" ? 45 : timeframe === "3M" ? 120 : 370;
      try {
        const next = await fetchCandles(selectedSymbol, limit);
        if (!active) return;
        setCandles(next);
      } catch (error) {
        if (!active) return;
        setCandles([]);
        setCandleError(error instanceof Error ? error.message : "Unable to load chart.");
      } finally {
        if (active) setIsLoadingCandles(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [selectedSymbol, timeframe]);

  const selectedPrice = priceBySymbol[selectedSymbol] || 0;

  const executeTrade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !portfolio) return;

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setTradeError("Quantity must be greater than zero.");
      setTradeMessage("");
      return;
    }
    if (!selectedPrice) {
      setTradeError("Selected symbol has no valid price.");
      setTradeMessage("");
      return;
    }

    setIsTrading(true);
    setTradeError("");
    setTradeMessage("");

    try {
      const nextPortfolio: PortfolioState = {
        startingCash: portfolio.startingCash,
        cash: portfolio.cash,
        holdings: [...portfolio.holdings],
      };

      const holdingIndex = nextPortfolio.holdings.findIndex((holding) => holding.symbol === selectedSymbol);
      const existingHolding = holdingIndex >= 0 ? nextPortfolio.holdings[holdingIndex] : null;

      if (side === "buy") {
        const cost = qty * selectedPrice;
        if (cost > nextPortfolio.cash) throw new Error("Not enough cash for this buy order.");
        nextPortfolio.cash -= cost;
        if (!existingHolding) {
          nextPortfolio.holdings.push({
            symbol: selectedSymbol,
            name: nameBySymbol[selectedSymbol] || selectedSymbol,
            quantity: qty,
            avgPrice: selectedPrice,
          });
        } else {
          const newQuantity = existingHolding.quantity + qty;
          const newAverage = ((existingHolding.quantity * existingHolding.avgPrice) + cost) / newQuantity;
          nextPortfolio.holdings[holdingIndex] = { ...existingHolding, quantity: newQuantity, avgPrice: newAverage };
        }
      } else {
        if (!existingHolding || existingHolding.quantity < qty) throw new Error("Not enough holdings to sell this quantity.");
        nextPortfolio.cash += qty * selectedPrice;
        const remaining = existingHolding.quantity - qty;
        if (remaining <= 0) {
          nextPortfolio.holdings = nextPortfolio.holdings.filter((holding) => holding.symbol !== selectedSymbol);
        } else {
          nextPortfolio.holdings[holdingIndex] = { ...existingHolding, quantity: remaining };
        }
      }

      const saved = await savePortfolio(session.email, nextPortfolio);
      setPortfolio(saved);
      setQuantity("");
      setTradeMessage(`${side === "buy" ? "Buy" : "Sell"} order executed and saved.`);
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : "Trade failed.");
    } finally {
      setIsTrading(false);
    }
  };

  if (!session) {
    return (
      <main className="relative min-h-screen bg-background px-4 py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm text-muted-foreground">Please sign in first to open trading.</p>
          <Link to="/account" className="mt-4 inline-block rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
            Go to account
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(49,212,255,0.14),transparent_34%),radial-gradient(circle_at_84%_80%,rgba(122,88,255,0.12),transparent_34%)]" />
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-6 md:px-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate("/account")} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-3 py-2 text-sm text-foreground hover:bg-white/[0.08]">
              <ArrowLeft size={14} />
              Back to account
            </button>
            <Link to="/" className="inline-flex items-center rounded-xl border border-white/20 bg-white/[0.04] px-3 py-2 text-sm text-foreground hover:bg-white/[0.08]">
              Main menu
            </Link>
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{session.email}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="glass-card rounded-3xl border border-white/10 p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Trade ticket</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">Buy and sell assets</h1>
            <form className="mt-6 space-y-4" onSubmit={executeTrade}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Action</label>
                  <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                    <button type="button" onClick={() => setSide("buy")} className={`rounded-lg px-3 py-2 text-sm transition ${side === "buy" ? "bg-emerald-300/20 text-emerald-200" : "text-muted-foreground hover:text-foreground"}`}>Buy</button>
                    <button type="button" onClick={() => setSide("sell")} className={`rounded-lg px-3 py-2 text-sm transition ${side === "sell" ? "bg-amber-300/20 text-amber-200" : "text-muted-foreground hover:text-foreground"}`}>Sell</button>
                  </div>
                </div>
                <div>
                  <label htmlFor="symbol" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Symbol</label>
                  <select id="symbol" value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40">
                    {cryptoAssets.map((asset) => (
                      <option key={asset.symbol} value={asset.symbol} className="bg-slate-900">
                        {asset.symbol} - {asset.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="quantity" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Quantity</label>
                  <input id="quantity" type="number" min="0" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0.00" className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40" />
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Current price</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">${selectedPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
                Estimated value: ${(Math.max(Number(quantity) || 0, 0) * selectedPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </div>

              {tradeError && <p className="text-sm text-red-300">{tradeError}</p>}
              {tradeMessage && <p className="text-sm text-emerald-300">{tradeMessage}</p>}

              <button type="submit" disabled={isTrading || isLoading} className="w-full rounded-xl border border-cyan-300/35 bg-gradient-to-r from-cyan-300/20 to-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:from-cyan-300/30 hover:to-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                {isTrading ? "Saving trade..." : `Execute ${side === "buy" ? "Buy" : "Sell"}`}
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="glass-card rounded-3xl border border-white/10 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Selected asset chart</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{selectedSymbol}</h2>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
                  {(["1W", "1M", "3M", "1Y"] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`rounded-md px-2.5 py-1 text-[10px] transition ${timeframe === tf ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-3">
                <div className="h-[280px]">
                  <CandlestickChart color={colorBySymbol[selectedSymbol] || "#22d3ee"} candles={candles} />
                </div>
                {(isLoadingCandles || candleError) && (
                  <p className={`mt-2 text-xs ${candleError ? "text-red-400" : "text-muted-foreground"}`}>
                    {candleError ? "Chart unavailable right now." : "Loading chart..."}
                  </p>
                )}
              </div>
            </div>

            <div className="glass-card rounded-3xl border border-white/10 p-5 sm:p-6">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Account status</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">Portfolio snapshot</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-muted-foreground">Cash</span>
                  <span className="font-semibold text-foreground">${(portfolio?.cash ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-muted-foreground">Positions</span>
                  <span className="font-semibold text-foreground">{portfolio?.holdings.length ?? 0}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {portfolio?.holdings.length ? (
                  portfolio.holdings.map((holding) => (
                    <div key={holding.symbol} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{holding.symbol}</p>
                        <p className="text-xs text-muted-foreground">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-muted-foreground">No positions yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Trade;
