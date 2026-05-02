import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { cryptoAssets } from "@/data/cryptoData";
import aegisLogo from "./aegisai-logo.png";
import {
  type ActionResponse,
  type AdminAccountView,
  type AdminAccountsResponse,
  buildLocalAccountState,
  loadStoredPortfolio,
  localLogin,
  localRegister,
  type AccountStateResponse,
  type PortfolioState,
  type SessionData,
} from "@/lib/portfolioStorage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SESSION_KEY = "aegis_account_session_v2";
const API_BASE = import.meta.env.VITE_MARKET_API_URL || "http://127.0.0.1:8010";
const PRIMARY_ADMIN_EMAIL = "admin@aegisai.com";

type AdminDraft = {
  email: string;
  password: string;
};

type DeleteContext =
  | { kind: "self" }
  | { kind: "admin"; targetEmail: string };

const parseAssetPrice = (rawPrice: string) => Number(rawPrice.replace(/\$/g, "").replace(/,/g, ""));

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

const saveSession = (sessionData: SessionData) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
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
    throw new ApiError(response.status, payload.detail || "Request failed.");
  }
  return payload as T;
};

const loginAccount = async (email: string, password: string) => {
  try {
    const response = await fetchJson<AccountStateResponse>("/account/login", {
      method: "POST",
      body: JSON.stringify({ email: normalizeEmail(email), password: password.trim() }),
    });
    if ("session" in response && "portfolio" in response) {
      return response;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.warn("Backend login is unavailable, using local account mode.", error);
  }
  return localLogin(email);
};

const registerAccount = async (email: string, password: string) => {
  try {
    const response = await fetchJson<AccountStateResponse>("/account/register", {
      method: "POST",
      body: JSON.stringify({ email: normalizeEmail(email), password: password.trim() }),
    });
    if ("session" in response && "portfolio" in response) {
      return response;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.warn("Backend register is unavailable, using local account mode.", error);
  }
  return localRegister(email);
};

const loadPortfolio = async (email: string, sessionToken: string) => {
  try {
    const response = await fetchJson<PortfolioState>(
      `/account/portfolio?email=${encodeURIComponent(normalizeEmail(email))}&session_token=${encodeURIComponent(sessionToken)}`,
    );
    if ("cash" in response && "holdings" in response) {
      return response;
    }
  } catch (error) {
    console.warn("Backend portfolio endpoint is unavailable, using local portfolio storage.", error);
  }
  return loadStoredPortfolio(email);
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

const saveProfile = async (session: SessionData, nextEmail: string, nextPassword: string) => {
  return fetchJson<AccountStateResponse>("/account/profile", {
    method: "PATCH",
    body: JSON.stringify({
      email: normalizeEmail(session.email),
      sessionToken: session.sessionToken,
      new_email: normalizeEmail(nextEmail),
      new_password: nextPassword.trim() || undefined,
    }),
  });
};

const saveAdminAccount = async (
  session: SessionData,
  targetEmail: string,
  update: { email: string; password: string; role?: "admin" | "user" },
) => {
  return fetchJson<AdminAccountView>("/account/admin/users", {
    method: "PATCH",
    body: JSON.stringify({
      admin_email: normalizeEmail(session.email),
      sessionToken: session.sessionToken,
      target_email: normalizeEmail(targetEmail),
      new_email: normalizeEmail(update.email),
      new_password: update.password.trim() || undefined,
      role: update.role,
    }),
  });
};

const deleteOwnAccount = async (session: SessionData, feedback: string) => {
  return fetchJson<ActionResponse>("/account/profile", {
    method: "DELETE",
    body: JSON.stringify({
      email: normalizeEmail(session.email),
      sessionToken: session.sessionToken,
      feedback,
    }),
  });
};

const deleteManagedAccount = async (session: SessionData, targetEmail: string, feedback: string) => {
  return fetchJson<ActionResponse>("/account/admin/users", {
    method: "DELETE",
    body: JSON.stringify({
      admin_email: normalizeEmail(session.email),
      sessionToken: session.sessionToken,
      target_email: normalizeEmail(targetEmail),
      feedback,
    }),
  });
};

const Account = () => {
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminAccountView[]>([]);
  const [adminDrafts, setAdminDrafts] = useState<Record<string, AdminDraft>>({});
  const [isAdminUsersLoading, setIsAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminActionError, setAdminActionError] = useState("");
  const [adminActionMessage, setAdminActionMessage] = useState("");
  const [adminBusyKey, setAdminBusyKey] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [isProfileBusy, setIsProfileBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteContext, setDeleteContext] = useState<DeleteContext | null>(null);
  const [deleteStep, setDeleteStep] = useState<"confirm" | "feedback">("confirm");
  const [deleteFeedback, setDeleteFeedback] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleteBusy, setIsDeleteBusy] = useState(false);

  const refreshAdminUsers = async (adminEmail: string, sessionToken: string) => {
    setIsAdminUsersLoading(true);
    setAdminUsersError("");
    try {
      const users = await loadAdminUsers(adminEmail, sessionToken);
      setAdminUsers(users);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load admin users.";
      setAdminUsersError(message);
      setAdminUsers([]);
    } finally {
      setIsAdminUsersLoading(false);
    }
  };

  const resetDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteContext(null);
    setDeleteStep("confirm");
    setDeleteFeedback("");
    setDeleteError("");
    setIsDeleteBusy(false);
  };

  const priceBySymbol = useMemo(() => {
    return Object.fromEntries(cryptoAssets.map((asset) => [asset.symbol, parseAssetPrice(asset.price)])) as Record<string, number>;
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const sessionData = loadSession();
      if (!sessionData) return;
      setSession(sessionData);
      setIsLoggedIn(true);
      setProfileEmail(sessionData.email);
      try {
        const remotePortfolio = await loadPortfolio(sessionData.email, sessionData.sessionToken);
        setPortfolio(remotePortfolio);
        if (sessionData.role === "admin") {
          await refreshAdminUsers(sessionData.email, sessionData.sessionToken);
        }
      } catch {
        const fallback = buildLocalAccountState(sessionData.email);
        setSession(fallback.session);
        setProfileEmail(fallback.session.email);
        setPortfolio(fallback.portfolio);
        setIsLoggedIn(true);
        setAdminUsers([]);
        setAdminUsersError("");
      }
    };
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!session) return;
    setProfileEmail(session.email);
    setProfilePassword("");
  }, [session]);

  useEffect(() => {
    const nextDrafts: Record<string, AdminDraft> = {};
    adminUsers.forEach((userItem) => {
      nextDrafts[userItem.email] = {
        email: userItem.email,
        password: userItem.password,
      };
    });
    setAdminDrafts(nextDrafts);
  }, [adminUsers]);

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
      setProfileEmail(response.session.email);
      setPortfolio(response.portfolio);
      setIsLoggedIn(true);
      if (response.session.role === "admin") {
        await refreshAdminUsers(response.session.email, response.session.sessionToken);
      } else {
        setAdminUsers([]);
        setAdminUsersError("");
      }
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
      setProfileEmail(response.session.email);
      setPortfolio(response.portfolio);
      setIsLoggedIn(true);
      if (response.session.role === "admin") {
        await refreshAdminUsers(response.session.email, response.session.sessionToken);
      } else {
        setAdminUsers([]);
        setAdminUsersError("");
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Account creation failed.";
      setError(message);
    } finally {
      setIsBusy(false);
    }
  };

  const logout = () => {
    clearSession();
    setIsLoggedIn(false);
    setSession(null);
    setPortfolio(null);
    setAdminUsers([]);
    setAdminUsersError("");
    setPassword("");
    setError("");
    setProfileEmail("");
    setProfilePassword("");
    setProfileError("");
    setProfileMessage("");
    setAdminActionError("");
    setAdminActionMessage("");
    resetDeleteDialog();
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

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;

    const nextEmail = normalizeEmail(profileEmail);
    const nextPassword = profilePassword.trim();
    if (!nextEmail) {
      setProfileError("Email cannot be empty.");
      return;
    }
    if (nextEmail === normalizeEmail(session.email) && !nextPassword) {
      setProfileError("Change your email or add a new password first.");
      return;
    }

    setIsProfileBusy(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const response = await saveProfile(session, nextEmail, nextPassword);
      saveSession(response.session);
      setSession(response.session);
      setPortfolio(response.portfolio);
      setProfileEmail(response.session.email);
      setProfilePassword("");
      setProfileMessage("Account details updated.");
      if (response.session.role === "admin") {
        await refreshAdminUsers(response.session.email, response.session.sessionToken);
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not update your account.";
      setProfileError(message);
    } finally {
      setIsProfileBusy(false);
    }
  };

  const updateAdminDraft = (targetEmail: string, patch: Partial<AdminDraft>) => {
    setAdminDrafts((current) => ({
      ...current,
      [targetEmail]: {
        email: current[targetEmail]?.email ?? targetEmail,
        password: current[targetEmail]?.password ?? "",
        ...patch,
      },
    }));
  };

  const handleAdminSave = async (userItem: AdminAccountView) => {
    if (!session) return;
    const draft = adminDrafts[userItem.email] ?? { email: userItem.email, password: userItem.password };
    const nextEmail = normalizeEmail(draft.email);
    const nextPassword = draft.password.trim();
    if (!nextEmail) {
      setAdminActionError("Email cannot be empty.");
      return;
    }
    if (nextEmail === normalizeEmail(userItem.email) && !nextPassword) {
      setAdminActionError("Change the email or password before saving.");
      return;
    }

    setAdminBusyKey(`save:${userItem.email}`);
    setAdminActionError("");
    setAdminActionMessage("");
    try {
      await saveAdminAccount(session, userItem.email, {
        email: nextEmail,
        password: nextPassword,
      });
      await refreshAdminUsers(session.email, session.sessionToken);
      setAdminActionMessage(`Updated ${userItem.email}.`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not update that account.";
      setAdminActionError(message);
    } finally {
      setAdminBusyKey("");
    }
  };

  const handleRoleToggle = async (userItem: AdminAccountView) => {
    if (!session) return;
    const nextRole = userItem.role === "admin" ? "user" : "admin";
    setAdminBusyKey(`role:${userItem.email}`);
    setAdminActionError("");
    setAdminActionMessage("");
    try {
      await saveAdminAccount(session, userItem.email, {
        email: userItem.email,
        password: "",
        role: nextRole,
      });
      await refreshAdminUsers(session.email, session.sessionToken);
      setAdminActionMessage(`${userItem.email} is now ${nextRole}.`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not change that role.";
      setAdminActionError(message);
    } finally {
      setAdminBusyKey("");
    }
  };

  const openDeleteDialog = (context: DeleteContext) => {
    setDeleteContext(context);
    setDeleteStep("confirm");
    setDeleteFeedback("");
    setDeleteError("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!session || !deleteContext) return;
    if (deleteContext.kind === "self" && !deleteFeedback.trim()) {
      setDeleteError("Please tell us why you want to delete your account.");
      return;
    }

    setIsDeleteBusy(true);
    setDeleteError("");
    try {
      if (deleteContext.kind === "self") {
        await deleteOwnAccount(session, deleteFeedback.trim());
        resetDeleteDialog();
        logout();
        navigate("/");
        return;
      }

      await deleteManagedAccount(session, deleteContext.targetEmail, deleteFeedback.trim());
      await refreshAdminUsers(session.email, session.sessionToken);
      setAdminActionMessage(`${deleteContext.targetEmail} was deleted.`);
      resetDeleteDialog();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not delete that account.";
      setDeleteError(message);
    } finally {
      setIsDeleteBusy(false);
    }
  };

  const deleteTargetLabel = deleteContext?.kind === "admin" ? deleteContext.targetEmail : session?.email ?? "your account";

  return (
    <>
      <section className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-center px-4 pt-10 sm:px-6 md:px-10">
        {!isLoggedIn ? (
          <div className="glass-card premium-border relative w-full max-w-md rounded-3xl border border-white/20 p-8 shadow-2xl sm:p-10">
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
          <div className="glass-card premium-border relative w-full max-w-5xl rounded-[40px] p-8 sm:p-12 shadow-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Account dashboard</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Virtual account</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Signed in as {session?.email ?? "user"} ({session?.role ?? "user"}). Portfolio uses backend routes when available and local storage as a fallback.
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

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Account settings</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">Email, password, and delete controls</h2>
                </div>
                <button
                  type="button"
                  onClick={() => openDeleteDialog({ kind: "self" })}
                  className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
                >
                  Delete my account
                </button>
              </div>

              <form onSubmit={handleProfileSave} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div>
                  <label htmlFor="profile-email" className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Email</label>
                  <input
                    id="profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(event) => setProfileEmail(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40"
                    placeholder="you@aegisai.com"
                  />
                </div>
                <div>
                  <label htmlFor="profile-password" className="text-xs uppercase tracking-[0.22em] text-muted-foreground">New password</label>
                  <input
                    id="profile-password"
                    type="password"
                    value={profilePassword}
                    onChange={(event) => setProfilePassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-300/40"
                    placeholder="Leave blank to keep current password"
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={isProfileBusy} className="w-full rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60">
                    {isProfileBusy ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>

              {profileError && <p className="mt-3 text-sm text-red-300">{profileError}</p>}
              {profileMessage && <p className="mt-3 text-sm text-emerald-300">{profileMessage}</p>}
            </div>

            {session?.role === "admin" && (
              <div className="mt-6 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/90">Admin panel</p>
                    <h2 className="mt-1 text-xl font-semibold text-cyan-100">Users, portfolio, and history</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/admin/history"
                      className="rounded-lg border border-cyan-300/40 bg-cyan-300/15 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25"
                    >
                      Open history view
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        if (session?.email && session.sessionToken) {
                          void refreshAdminUsers(session.email, session.sessionToken);
                        }
                      }}
                      className="rounded-lg border border-cyan-300/40 bg-cyan-300/15 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25"
                    >
                      {isAdminUsersLoading ? "Refreshing..." : "Refresh list"}
                    </button>
                  </div>
                </div>

                {adminUsersError && <p className="mt-3 text-sm text-red-300">{adminUsersError}</p>}
                {adminActionError && <p className="mt-3 text-sm text-red-300">{adminActionError}</p>}
                {adminActionMessage && <p className="mt-3 text-sm text-emerald-300">{adminActionMessage}</p>}

                <div className="mt-4 space-y-3">
                  {adminUsers.map((userItem) => {
                    const draft = adminDrafts[userItem.email] ?? { email: userItem.email, password: userItem.password };
                    const isSelf = normalizeEmail(userItem.email) === normalizeEmail(session.email);
                    const isPrimaryAdmin = normalizeEmail(userItem.email) === PRIMARY_ADMIN_EMAIL;

                    return (
                      <div key={userItem.email} className="rounded-xl border border-cyan-300/20 bg-black/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-cyan-100">{userItem.email}</p>
                            {isSelf && <p className="mt-1 text-[11px] text-cyan-200/80">Use the account settings section above to edit your own login details.</p>}
                          </div>
                          <p className="rounded-full border border-cyan-300/30 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-cyan-200">
                            {userItem.role}
                          </p>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">Email</label>
                            <input
                              type="email"
                              value={draft.email}
                              onChange={(event) => updateAdminDraft(userItem.email, { email: event.target.value })}
                              disabled={isSelf || isPrimaryAdmin}
                              className="mt-2 w-full rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">Password</label>
                            <input
                              type="text"
                              value={draft.password}
                              onChange={(event) => updateAdminDraft(userItem.email, { password: event.target.value })}
                              disabled={isSelf}
                              className="mt-2 w-full rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => void handleAdminSave(userItem)}
                              disabled={isSelf || adminBusyKey === `save:${userItem.email}`}
                              className="w-full rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {adminBusyKey === `save:${userItem.email}` ? "Saving..." : "Save"}
                            </button>
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => void handleRoleToggle(userItem)}
                              disabled={isSelf || isPrimaryAdmin || adminBusyKey === `role:${userItem.email}`}
                              className="w-full rounded-xl border border-amber-300/35 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {adminBusyKey === `role:${userItem.email}` ? "Working..." : userItem.role === "admin" ? "Make user" : "Make admin"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-xs text-cyan-50 sm:grid-cols-3">
                          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-2 py-1.5">
                            Cash: ${userItem.portfolio.cash.toLocaleString()}
                          </div>
                          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-2 py-1.5">
                            Holdings: {userItem.portfolio.holdings.length}
                          </div>
                          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-2 py-1.5">
                            History entries: {userItem.history.length}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openDeleteDialog({ kind: "admin", targetEmail: userItem.email })}
                            disabled={isSelf || isPrimaryAdmin}
                            className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Delete account
                          </button>
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/90">Trade history</p>
                          {userItem.history.length ? (
                            userItem.history
                              .slice()
                              .reverse()
                              .slice(0, 8)
                              .map((entry) => (
                                <div key={`${entry.timestamp}-${entry.side}-${entry.symbol}-${entry.quantity}`} className="rounded-lg border border-cyan-300/15 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-100/90">
                                  {new Date(entry.timestamp).toLocaleString()} | {entry.side.toUpperCase()} {entry.quantity} {entry.symbol} @ ${entry.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                </div>
                              ))
                          ) : (
                            <div className="rounded-lg border border-dashed border-cyan-300/20 px-3 py-2 text-xs text-cyan-200/80">
                              No trade history yet.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {!adminUsers.length && !isAdminUsersLoading && !adminUsersError && (
                    <div className="rounded-xl border border-dashed border-cyan-300/25 p-3 text-sm text-cyan-200/90">
                      No users found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetDeleteDialog();
            return;
          }
          setDeleteDialogOpen(true);
        }}
      >
        <DialogContent className="border-white/10 bg-slate-950 text-slate-50 sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center">
              <img src={aegisLogo} alt="AegisAI" className="h-14 w-14 rounded-2xl border border-white/10 bg-white/5 object-contain p-2" />
            </div>
            <DialogTitle>{deleteStep === "confirm" ? "Delete account?" : "Before you delete"}</DialogTitle>
            <DialogDescription className="text-slate-300">
              {deleteStep === "confirm"
                ? `This will permanently remove ${deleteTargetLabel}.`
                : deleteContext?.kind === "self"
                  ? "Tell us why you want to delete your account before you confirm."
                  : "You can leave an optional note about why this account is being removed."}
            </DialogDescription>
          </DialogHeader>

          {deleteStep === "feedback" && (
            <div>
              <label htmlFor="delete-feedback" className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {deleteContext?.kind === "self" ? "Your feedback" : "Reason"}
              </label>
              <textarea
                id="delete-feedback"
                value={deleteFeedback}
                onChange={(event) => setDeleteFeedback(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                placeholder={deleteContext?.kind === "self" ? "Tell us what made you leave..." : "Optional admin note"}
              />
            </div>
          )}

          {deleteError && <p className="text-sm text-red-300">{deleteError}</p>}

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={resetDeleteDialog}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-slate-100 transition hover:bg-white/[0.08]"
            >
              Cancel
            </button>
            {deleteStep === "confirm" ? (
              <button
                type="button"
                onClick={() => setDeleteStep("feedback")}
                className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
              >
                Yes, continue
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleteBusy || (deleteContext?.kind === "self" && !deleteFeedback.trim())}
                className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleteBusy ? "Deleting..." : "Delete account"}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Account;
