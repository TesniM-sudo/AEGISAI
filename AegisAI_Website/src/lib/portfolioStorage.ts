export type Role = "admin" | "user";

export type SessionData = {
  email: string;
  role: Role;
  sessionToken: string;
};

export type Holding = {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
};

export type PortfolioState = {
  startingCash: number;
  cash: number;
  holdings: Holding[];
};

export type HistoryEntry = {
  timestamp: string;
  side: "buy" | "sell" | "manual";
  symbol: string;
  quantity: number;
  price: number;
  total: number;
  note?: string | null;
};

export type AccountStateResponse = {
  session: SessionData;
  portfolio: PortfolioState;
};

export type AdminAccountView = {
  email: string;
  password: string;
  role: Role;
  portfolio: PortfolioState;
  history: HistoryEntry[];
};

export type AdminAccountsResponse = {
  users: AdminAccountView[];
};

export type ActionResponse = {
  ok: boolean;
  message: string;
};

const PORTFOLIO_PREFIX = "aegis_portfolio_v1:";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const createDefaultPortfolio = (): PortfolioState => ({
  startingCash: 100000,
  cash: 100000,
  holdings: [],
});

export const loadStoredPortfolio = (email: string): PortfolioState => {
  const key = `${PORTFOLIO_PREFIX}${normalizeEmail(email)}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    return createDefaultPortfolio();
  }

  try {
    const parsed = JSON.parse(raw) as PortfolioState;
    return {
      startingCash: Number(parsed.startingCash) || 100000,
      cash: Number(parsed.cash) || 0,
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
    };
  } catch {
    return createDefaultPortfolio();
  }
};

export const saveStoredPortfolio = (email: string, portfolio: PortfolioState): PortfolioState => {
  const key = `${PORTFOLIO_PREFIX}${normalizeEmail(email)}`;
  localStorage.setItem(key, JSON.stringify(portfolio));
  return portfolio;
};

export const buildLocalAccountState = (email: string): AccountStateResponse => ({
  session: {
    email: normalizeEmail(email),
    role: normalizeEmail(email) === "admin@aegisai.com" ? "admin" : "user",
    sessionToken: `local-${normalizeEmail(email)}`,
  },
  portfolio: loadStoredPortfolio(email),
});

export const localLogin = (email: string): AccountStateResponse => buildLocalAccountState(email);

export const localRegister = (email: string): AccountStateResponse => buildLocalAccountState(email);
