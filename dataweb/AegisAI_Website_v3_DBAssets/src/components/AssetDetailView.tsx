import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown, Clock3, BarChart3, ShieldAlert } from "lucide-react";
import CandlestickChart, { type Candle } from "./CandlestickChart";
import { fetchCandles } from "@/lib/marketApi";

interface AssetDetailViewProps {
  asset: {
    symbol: string;
    name: string;
    balance: string;
    price: string;
    change: string;
    changePositive: boolean;
    color: string;
    outlook: string;
    riskBand: string;
    confidence: string;
    candles?: Candle[];
  };
  onClose: () => void;
}

const AssetDetailView = ({ asset, onClose }: AssetDetailViewProps) => {
  const [timeframe, setTimeframe] = useState<"1D" | "1W" | "1M" | "3M" | "1Y">("1M");
  const [allCandles, setAllCandles] = useState<Candle[] | undefined>(asset.candles);
  const [isLoadingCandles, setIsLoadingCandles] = useState(false);
  const [hasLiveCandleError, setHasLiveCandleError] = useState(false);

  useEffect(() => {
    setAllCandles(asset.candles);
  }, [asset]);

  useEffect(() => {
    let active = true;

    const hydrateCandles = async () => {
      setIsLoadingCandles(true);
      setHasLiveCandleError(false);
      try {
        const next = await fetchCandles(asset.symbol, 365);
        if (active) {
          setAllCandles(next);
        }
      } catch (error) {
        console.error(`Failed to load candles for ${asset.symbol}`, error);
        if (active) {
          setHasLiveCandleError(true);
        }
      } finally {
        if (active) {
          setIsLoadingCandles(false);
        }
      }
    };

    void hydrateCandles();
    return () => {
      active = false;
    };
  }, [asset.symbol]);

  const visibleCandles = useMemo(() => {
    if (!allCandles || allCandles.length === 0) return allCandles;

    const datedCandles = allCandles
      .map((candle) => {
        if (!candle.date) return null;
        const dateObj = new Date(candle.date);
        if (Number.isNaN(dateObj.getTime())) return null;
        return { candle, dateObj };
      })
      .filter((item): item is { candle: Candle; dateObj: Date } => item !== null);

    if (datedCandles.length === 0) {
      return [];
    }

    const end = datedCandles[datedCandles.length - 1].dateObj;
    const start = new Date(end);
    if (timeframe === "1D") {
      start.setDate(end.getDate() - 1);
    } else if (timeframe === "1W") {
      start.setDate(end.getDate() - 7);
    } else if (timeframe === "1M") {
      start.setMonth(end.getMonth() - 1);
    } else if (timeframe === "3M") {
      start.setMonth(end.getMonth() - 3);
    } else {
      start.setFullYear(end.getFullYear() - 1);
    }

    const filtered = datedCandles
      .filter(({ dateObj }) => dateObj >= start && dateObj <= end)
      .map(({ candle }) => candle);

    if (filtered.length > 0) {
      return filtered;
    }

    return [];
  }, [allCandles, timeframe]);

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[100] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="absolute inset-0 bg-background/92 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse-glow sm:h-[560px] sm:w-[560px] md:h-[700px] md:w-[700px]"
          style={{ background: `radial-gradient(circle, ${asset.color}15 0%, transparent 70%)` }}
        />

        <motion.div
          className="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-none md:h-[86vh] md:max-h-[760px] md:w-[95vw] md:max-w-5xl md:rounded-3xl"
          initial={{ rotateY: 180, scale: 0.3, opacity: 0 }}
          animate={{ rotateY: 0, scale: 1, opacity: 1 }}
          exit={{ rotateY: -180, scale: 0.3, opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ perspective: 1200 }}
        >
          <div className="glass-card flex flex-1 flex-col overflow-y-auto md:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/20 bg-background/70 p-4 backdrop-blur md:p-5">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full" style={{ background: asset.color }} />
                <div>
                  <h2 className="text-lg font-bold text-foreground">{asset.name}</h2>
                  <p className="text-xs text-muted-foreground">{asset.symbol}</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 transition-colors hover:bg-muted/30">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 md:flex-row md:items-center md:gap-6">
              <div>
                <p className="text-2xl font-bold text-foreground">{asset.price}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {asset.changePositive ? <TrendingUp size={12} style={{ color: "hsl(142, 70%, 50%)" }} /> : <TrendingDown size={12} style={{ color: "hsl(0, 70%, 55%)" }} />}
                  <span className="text-xs font-medium" style={{ color: asset.changePositive ? "hsl(142, 70%, 50%)" : "hsl(0, 70%, 55%)" }}>
                    {asset.change}
                  </span>
                  <span className="text-xs text-muted-foreground">24h</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 md:ml-auto">
                {(["1D", "1W", "1M", "3M", "1Y"] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      timeframe === tf ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                    }`}
                    style={timeframe === tf ? { background: `${asset.color}20`, color: asset.color } : {}}
                  >
                    {tf}
                  </button>
                ))}
                {isLoadingCandles && <span className="ml-1 text-[10px] text-muted-foreground">Loading...</span>}
              </div>
            </div>

            <div className="px-4 pb-2 sm:px-5">
              <div className="rounded-[28px] border border-white/10 bg-black/10 p-3 sm:p-4">
                <div className="h-[220px] sm:h-[280px] md:h-[320px]">
                  <CandlestickChart color={asset.color} candles={visibleCandles} />
                </div>
                {hasLiveCandleError && (
                  <p className="mt-2 text-xs text-red-400">
                    Live candle API is offline or unreachable at 127.0.0.1:8010.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
              <div className="glass-card rounded-xl p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <BarChart3 size={10} className="text-muted-foreground/50" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Model confidence</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{asset.confidence}</p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <ShieldAlert size={10} className="text-muted-foreground/50" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Risk profile</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{asset.riskBand}</p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <TrendingUp size={10} className="text-muted-foreground/50" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Portfolio fit</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{asset.balance}</p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Clock3 size={10} className="text-muted-foreground/50" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Narrative</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{asset.outlook}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AssetDetailView;
