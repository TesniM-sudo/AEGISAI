import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cryptoAssets } from "@/data/cryptoData";
import type { AdminAccountView, AdminAccountsResponse, SessionData } from "@/lib/portfolioStorage";

const SESSION_KEY = "aegis_account_session_v2";
const API_BASE = import.meta.env.VITE_MARKET_API_URL || "http://127.0.0.1:8010";

type HistoryRow = AdminAccountView["history"][number] & {
  assetName: string;
  assetType: "stock" | "crypto" | "forex" | "other";
};

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const loadSession = (): SessionData | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.email || !parsed?.role || !parsed?.sessionToken) return null;
    if (parsed.sessionToken.startsWith("mock-session-token-") || parsed.sessionToken.startsWith("local-")) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
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
    `/account/admin/users?admin_email=${encodeURIComponent(normalizeEmail(adminEmail))}&session_token=${encodeURIComponent(sessionToken)}`,
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

const AccountHistoryDetail = () => {
  const { email = "" } = useParams();
  const targetEmail = decodeURIComponent(email);
  const [account, setAccount] = useState<AdminAccountView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const hydrate = async () => {
    const activeSession = loadSession();
    if (!activeSession) {
      setError("Please sign in as an admin to view account history.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const users = await loadAdminUsers(activeSession.email, activeSession.sessionToken);
      const match = users.find((userItem) => normalizeEmail(userItem.email) === normalizeEmail(targetEmail));
      if (!match) {
        throw new Error("Account not found.");
      }
      setAccount(match);
    } catch (requestError) {
      setAccount(null);
      setError(requestError instanceof Error ? requestError.message : "Could not load account history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void hydrate();
  }, [targetEmail]);

  const rows = useMemo<HistoryRow[]>(() => {
    if (!account) return [];
    return account.history
      .map((entry) => {
        const meta = metadataBySymbol[entry.symbol] ?? { name: entry.symbol, assetType: "other" as const };
        return { ...entry, assetName: meta.name, assetType: meta.assetType };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [account]);

  const totalVolume = useMemo(() => rows.reduce((sum, row) => sum + row.total, 0), [rows]);
  const buyCount = useMemo(() => rows.filter((row) => row.side === "buy").length, [rows]);
  const sellCount = useMemo(() => rows.filter((row) => row.side === "sell").length, [rows]);

  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-10 sm:px-6 md:px-10">
      <div className="glass-card premium-border rounded-[40px] p-8 shadow-2xl sm:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/90">Account history</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{targetEmail}</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Full trade history for this account, sorted from newest to oldest.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/account" className="rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20">
              Back to account
            </Link>
            <button
              type="button"
              onClick={() => void hydrate()}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-foreground transition hover:bg-white/[0.08]"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Trades</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{rows.length}</p>
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
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Notional</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-white/10 bg-white/[0.04]">
                <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
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
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Loading account history...</td>
                  </tr>
                ) : rows.length ? (
                  rows.map((row) => (
                    <tr key={`${row.timestamp}-${row.side}-${row.symbol}-${row.quantity}`} className="border-b border-white/5 text-sm text-foreground last:border-b-0">
                      <td className="px-4 py-3 align-top">
                        <div>{new Date(row.timestamp).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">{new Date(row.timestamp).toLocaleTimeString()}</div>
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
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No trade history for this account.</td>
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

export default AccountHistoryDetail;
