export interface DashboardAsset {
  symbol: string;
  name: string;
  balance: string;
  price: string;
  change: string;
  changePositive: boolean;
  sparkData: number[];
  color: string;
  glowClass: string;
  outlook: string;
  riskBand: string;
  confidence: string;
}

export interface CandlePoint {
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

const API_BASE = import.meta.env.VITE_MARKET_API_URL || "http://127.0.0.1:8010";

const formatPrice = (symbol: string, value: number) => {
  if (symbol.includes("=X")) {
    return value.toFixed(4);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value > 1000 ? 0 : 2,
  }).format(value);
};

const formatChange = (changePct: number) => `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;

type DashboardAssetRaw = {
  symbol: string;
  name: string;
  portfolio_fit: string;
  price: number;
  change_pct: number;
  spark_data: number[];
  color: string;
  glow_class: string;
  outlook: string;
  risk_band: string;
  confidence: string;
};

export const fetchDashboardAssets = async (): Promise<DashboardAsset[]> => {
  const resp = await fetch(`${API_BASE}/dashboard/assets`);
  if (!resp.ok) {
    throw new Error("Failed to load dashboard assets");
  }

  const json = (await resp.json()) as { data: DashboardAssetRaw[] };
  return json.data.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    balance: item.portfolio_fit,
    price: formatPrice(item.symbol, item.price),
    change: formatChange(item.change_pct),
    changePositive: item.change_pct >= 0,
    sparkData: item.spark_data,
    color: item.color,
    glowClass: item.glow_class,
    outlook: item.outlook,
    riskBand: item.risk_band,
    confidence: item.confidence,
  }));
};

const generateMockCandles = (points: number, seedStr: string): CandlePoint[] => {
  const candles: CandlePoint[] = [];
  // Use a pseudo-random seed based on the string length to make it deterministic-ish
  let basePrice = 100 + (seedStr.length * 10);
  for (let i = 0; i < points; i++) {
    const open = basePrice;
    // Slight upward bias
    const change = (Math.sin(i * 0.5) * 2) + (Math.random() - 0.45) * 4; 
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    candles.push({
      date: new Date(Date.now() - (points - i) * 24 * 60 * 60 * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000000),
    });
    basePrice = close;
  }
  return candles;
};

export const fetchCandles = async (symbol: string, limit = 60): Promise<CandlePoint[]> => {
  try {
    const params = new URLSearchParams({ symbol, limit: String(limit) });
    const resp = await fetch(`${API_BASE}/dashboard/candles?${params.toString()}`);
    if (!resp.ok) {
      throw new Error(`Failed to load candles for ${symbol}`);
    }
    const json = (await resp.json()) as { data: CandlePoint[] };
    return json.data;
  } catch (error) {
    console.warn(`Dashboard API unavailable, using fallback candles for ${symbol}:`, error);
    return generateMockCandles(limit, symbol);
  }
};

