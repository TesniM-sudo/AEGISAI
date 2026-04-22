import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cryptoAssets } from "@/data/cryptoData";
import type { AdminAccountsResponse, SessionData } from "@/lib/portfolioStorage";

const SESSION_KEY = "aegis_account_session_v2";
const API_BASE = import.meta.env.VITE_MARKET_API_URL || "http://127.0.0.1:8010";

type HistoryRow = {
  email: string;
  role: "admin" | "user";
  timestamp: string;
  side: "buy" | "sell" | "manual";
  symbol: string;
  quantity: number;
  price: number;
  total: number;
  note?: string | null;
  assetName: string;
  assetType: "stock" | "crypto" | "forex" | "other";
  dateKey: string;
};

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const loadSession = (): SessionData | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.email || !parsed?.role || !parsed?.sessionToken) return null;
    return parsed;
  } catch {
    return null;
  }
};

const fetchJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) {
    throw new ApiError(response.status, payload.detail || "Request failed.");
  }
  return payload as T;
};

const loadAdminUsers = async (adminEmail: string, sessionToken: string) => {
  const response = await fetchJson<AdminAccountsResponse>(
    `/account/admin/users?admin_email=${encodeURIComponent(adminEmail)}&session_token=${encodeURIComponent(sessionToken)}`,
  );
  if (!Array.isArray(response.users)) {
    throw new Error("Invalid admin users response.");
  }
  return response.users;
};

const metadataBySymbol = Object.fromEntries(
  cryptoAssets.map((asset) => {
    let assetType: HistoryRow["assetType"] = "other";
    if (asset.symbol === "AAPL" || asset.symbol === "TSLA") assetType = "stock";
    else if (asset.symbol === "BTC-USD" || asset.symbol === "ETH-USD") assetType = "crypto";
    else if (asset.symbol === "EURUSD=X") assetType = "forex";

    return [asset.symbol, { name: asset.name, assetType }];
  }),
) as Record<string, { name: string; assetType: HistoryRow["assetType"] }>;

const AdminHistory = () => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [accountEmails, setAccountEmails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState("all");

  const hydrate = async (activeSession: SessionData | null) => {
    if (!activeSession || activeSession.role !== "admin") {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const users = await loadAdminUsers(activeSession.email, activeSession.sessionToken);
      setAccountEmails(users.map((userItem) => userItem.email).sort());
      const nextRows = users.flatMap((userItem) =>
        userItem.history.map((entry) => {
          const meta = metadataBySymbol[entry.symbol] ?? { name: entry.symbol, assetType: "other" as const };
          const parsedDate = new Date(entry.timestamp);
          return {
            email: userItem.email,
            role: userItem.role,
            timestamp: entry.timestamp,
            side: entry.side,
            symbol: entry.symbol,
            quantity: entry.quantity,
            price: entry.price,
            total: entry.total,
            note: entry.note,
            assetName: meta.name,
            assetType: meta.assetType,
            dateKey: Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString().slice(0, 10),
          };
        }),
      );
      nextRows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRows(nextRows);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not load trade history.";
      setError(message);
      setRows([]);
      setAccountEmails([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const activeSession = loadSession();
    setSession(activeSession);
    void hydrate(activeSession);
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedSearch = emailSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (normalizedSearch && !row.email.toLowerCase().includes(normalizedSearch)) return false;
      if (symbolFilter !== "all" && row.symbol !== symbolFilter) return false;
      return true;
    });
  }, [rows, emailSearch, symbolFilter]);

  const availableSymbols = useMemo(
    () => Array.from(new Set([...cryptoAssets.map((asset) => asset.symbol), ...rows.map((row) => row.symbol)])),
    [rows],
  );
  const matchingEmailSuggestions = useMemo(() => {
    const normalizedSearch = emailSearch.trim().toLowerCase();
    if (!normalizedSearch) return [];
    return accountEmails
      .filter((value) => value.toLowerCase().includes(normalizedSearch))
      .slice(0, 6);
  }, [accountEmails, emailSearch]);
  const totalVolume = useMemo(() => filteredRows.reduce((sum, row) => sum + row.total, 0), [filteredRows]);
  const buyCount = useMemo(() => filteredRows.filter((row) => row.side === "buy").length, [filteredRows]);
  const sellCount = useMemo(() => filteredRows.filter((row) => row.side === "sell").length, [filteredRows]);

  if (!session || session.role !== "admin") {
    return (
      <section className="mx-auto max-w-3xl px-4 pt-20">
        <div className="glass-card rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Admin history</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Admin access required</h1>
          <p className="mt-3 text-sm text-muted-foreground">Sign in with the primary admin account to review trade history across users.</p>
          <div className="mt-5 flex gap-2">
            <Link to="/account" className="rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/20">
              Go to account
            </Link>
            <Link to="/" className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-foreground transition hover:bg-white/[0.08]">
              Main menu
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-12 pt-10 sm:px-6 md:px-10">
      <div className="glass-card premium-border rounded-[40px] p-8 shadow-2xl sm:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/90">Admin history</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Trade history review</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Review all user trades in one place, then narrow the list with a stock or symbol filter and a quick email search.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/account" className="rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20">
              Back to account
            </Link>
            <button
              type="button"
              onClick={() => void hydrate(session)}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-foreground transition hover:bg-white/[0.08]"
            >
              Refresh history
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Visible trades</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{filteredRows.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Buy trades</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">{buyCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Sell trades</p>
            <p className="mt-2 text-2xl font-semibold text-amber-200">{sellCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Visible notional</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Filters</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="relative">
              <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Search email</label>
              <input
                type="text"
                value={emailSearch}
                onChange={(event) => {
                  setEmailSearch(event.target.value);
                  setShowEmailSuggestions(true);
                }}
                onFocus={() => setShowEmailSuggestions(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowEmailSuggestions(false), 120);
                }}
                placeholder="Search by user email"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none focus:border-cyan-300/40"
              />
              {showEmailSuggestions && matchingEmailSuggestions.length ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur">
                  {matchingEmailSuggestions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onMouseDown={() => {
                        setEmailSearch(value);
                        setShowEmailSuggestions(false);
                      }}
                      className="block w-full border-b border-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 last:border-b-0"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Stock / symbol</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSymbolFilter("all")}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    symbolFilter === "all"
                      ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                      : "border-white/15 bg-white/[0.03] text-foreground hover:bg-white/[0.08]"
                  }`}
                >
                  All
                </button>
                {availableSymbols.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSymbolFilter(value)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      symbolFilter === value
                        ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                        : "border-white/15 bg-white/[0.03] text-foreground hover:bg-white/[0.08]"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-white/10 bg-white/[0.04]">
                <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Market</th>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Side</th>
                  <th className="px-4 py-3 font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">Loading history...</td>
                  </tr>
                ) : filteredRows.length ? (
                  filteredRows.map((row) => (
                    <tr key={`${row.email}-${row.timestamp}-${row.side}-${row.symbol}-${row.quantity}`} className="border-b border-white/5 text-sm text-foreground last:border-b-0">
                      <td className="px-4 py-3 align-top">
                        <div>{new Date(row.timestamp).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">{new Date(row.timestamp).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div>{row.email}</div>
                        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{row.role}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="capitalize">{row.assetType}</div>
                        <div className="text-xs text-muted-foreground">{row.assetName}</div>
                      </td>
                      <td className="px-4 py-3 align-top">{row.symbol}</td>
                      <td className="px-4 py-3 align-top">
                        <span className={`rounded-full px-2 py-1 text-xs uppercase tracking-[0.14em] ${row.side === "buy" ? "bg-emerald-400/10 text-emerald-300" : row.side === "sell" ? "bg-amber-400/10 text-amber-200" : "bg-slate-400/10 text-slate-200"}`}>
                          {row.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">{row.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td className="px-4 py-3 align-top">${row.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td className="px-4 py-3 align-top">
                        <div>${row.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        {row.note ? <div className="text-xs text-muted-foreground">{row.note}</div> : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No trades match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminHistory;
