import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import CryptoCard from "@/components/CryptoCard";
import AssetDetailView from "@/components/AssetDetailView";
import TickerTape from "@/components/TickerTape";
import BackgroundSparks from "@/components/BackgroundSparks";
import { cryptoAssets } from "@/data/cryptoData";
import { fetchCandles, fetchDashboardAssets, type CandlePoint, type DashboardAsset } from "@/lib/marketApi";

type SelectedAsset = DashboardAsset & { candles?: CandlePoint[] };

const Index = () => {
  const [assets, setAssets] = useState<DashboardAsset[]>(
    cryptoAssets.map((asset) => ({
      ...asset,
      sparkData: [...asset.sparkData],
    }))
  );
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [featuredSymbol, setFeaturedSymbol] = useState<string>(cryptoAssets[0]?.symbol ?? "AAPL");
  const [isLiveData, setIsLiveData] = useState(false);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const liveAssets = await fetchDashboardAssets();
        if (liveAssets.length > 0) {
          setAssets(liveAssets);
          setFeaturedSymbol((prev) => (liveAssets.some((asset) => asset.symbol === prev) ? prev : liveAssets[0].symbol));
          setIsLiveData(true);
        }
      } catch (error) {
        console.error("Dashboard API unavailable, using fallback assets:", error);
      }
    };

    void loadAssets();
  }, []);

  const featuredAsset = useMemo(
    () => assets.find((asset) => asset.symbol === featuredSymbol) ?? assets[0],
    [assets, featuredSymbol]
  );

  const openAssetDetails = async (asset: DashboardAsset) => {
    try {
      const candles = await fetchCandles(asset.symbol, 365);
      setSelectedAsset({ ...asset, candles });
      return;
    } catch (error) {
      console.error(`Failed to load candles for ${asset.symbol}`, error);
    }

    setSelectedAsset({ ...asset, candles: [] });
  };

  if (!featuredAsset) {
    return null;
  }

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-10 grid items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="flex flex-col justify-center py-2 md:py-4">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="max-w-4xl text-4xl font-extrabold leading-[1] tracking-tight sm:text-5xl md:text-7xl lg:text-8xl">
                <span className="text-gradient">Invest with</span>
                <br />
                <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-indigo-500 bg-clip-text text-transparent">Confidence.</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground/80 md:text-lg">
                The most intelligent way to track your holdings, identify risks, and get actionable insights with our <span className="text-foreground font-semibold">AegisAI</span>.
              </p>
              
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/trade"
                  className="group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-cyan-500 px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-cyan-400 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-background money-glow-emerald"
                >
                  <span className="relative z-10">Start Trading</span>
                  <ArrowUpRight size={18} className="relative z-10 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                </Link>
                <button
                  className="rounded-2xl border border-black/10 bg-black/5 px-8 py-4 text-sm font-bold uppercase tracking-wider text-foreground backdrop-blur-md transition-all hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  Learn More
                </button>
              </div>

              <div className="mt-10 flex items-center gap-6 border-t border-black/10 pt-8 dark:border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Active Assets</span>
                  <span className="text-xl font-bold text-foreground">240+</span>
                </div>
                <div className="h-8 w-px bg-black/10 dark:bg-white/5" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Global Volume</span>
                  <span className="text-xl font-bold text-foreground">$1.2T</span>
                </div>
                <div className="h-8 w-px bg-black/10 dark:bg-white/5" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">AI Accuracy</span>
                  <span className="text-xl font-bold text-emerald-400">94.2%</span>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="glass-card premium-border flex flex-col justify-between rounded-[40px] p-6 sm:p-8 animate-float shadow-2xl">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Featured market board</p>
                <p className="mt-1 text-base font-semibold text-foreground/95">What matters right now</p>
              </div>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-700 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-200 sm:text-right">
                {isLiveData ? "Live DB data" : "Fallback demo data"}
              </span>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {assets.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => setFeaturedSymbol(asset.symbol)}
                  className={`rounded-full border px-3 py-2 text-xs transition-all ${featuredAsset.symbol === asset.symbol ? "border-cyan-500/40 bg-cyan-500/15 text-foreground shadow-[0_10px_24px_-14px_rgba(34,211,238,0.7)]" : "border-black/10 bg-black/[0.03] text-muted-foreground hover:border-black/20 hover:text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"}`}
                >
                  {asset.symbol}
                </button>
              ))}
            </div>

            <div className="rounded-[24px] border border-black/10 bg-black/5 p-3 dark:border-white/15 dark:bg-black/25 sm:p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">{featuredAsset.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Live market pulse</p>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-3xl font-semibold tracking-tight">{featuredAsset.price}</p>
                  <p className="text-sm font-medium" style={{ color: featuredAsset.changePositive ? "hsl(142 70% 50%)" : "hsl(0 70% 55%)" }}>
                    {featuredAsset.change}
                  </p>
                </div>
              </div>

              <div className="mb-4 rounded-[20px] border border-black/10 bg-gradient-to-br from-black/[0.06] via-black/[0.03] to-transparent p-3 dark:border-white/10 dark:from-white/[0.06] dark:via-white/[0.03] sm:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Price momentum</p>
                  <div className="flex items-center gap-1">
                    {["1H", "24H", "7D"].map((label, idx) => (
                      <span
                        key={label}
                        className={`rounded-md px-2 py-1 text-[10px] ${idx === 1 ? "bg-black/10 dark:bg-white/15 text-foreground" : "bg-black/5 dark:bg-white/[0.05] text-muted-foreground"}`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="h-44">
                  <svg viewBox="0 0 360 170" className="h-full w-full">
                    <defs>
                      <linearGradient id="featuredLine" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={featuredAsset.color} stopOpacity="0.95" />
                        <stop offset="70%" stopColor="#8B7CFF" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#FFD86B" stopOpacity="0.9" />
                      </linearGradient>
                      <linearGradient id="featuredArea" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={featuredAsset.color} stopOpacity="0.28" />
                        <stop offset="100%" stopColor={featuredAsset.color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <g opacity="0.14" stroke="#ffffff">
                      <line x1="0" y1="20" x2="360" y2="20" />
                      <line x1="0" y1="60" x2="360" y2="60" />
                      <line x1="0" y1="100" x2="360" y2="100" />
                      <line x1="0" y1="140" x2="360" y2="140" />
                    </g>
                    <path
                      d={`M 10 128 C 42 124, 58 ${100 - (featuredAsset.sparkData[3] || 0) * 0.35}, 86 ${104 - (featuredAsset.sparkData[6] || 0) * 0.34} C 124 ${112 - (featuredAsset.sparkData[10] || 0) * 0.36}, 160 ${108 - (featuredAsset.sparkData[14] || 0) * 0.34}, 196 ${95 - (featuredAsset.sparkData[18] || 0) * 0.34} C 232 ${98 - (featuredAsset.sparkData[22] || 0) * 0.32}, 270 ${80 - (featuredAsset.sparkData[25] || 0) * 0.3}, 340 ${72 - (featuredAsset.sparkData[Math.min(29, featuredAsset.sparkData.length - 1)] || 0) * 0.3} L 340 170 L 10 170 Z`}
                      fill="url(#featuredArea)"
                    />
                    <path
                      d={`M 10 128 C 42 124, 58 ${100 - (featuredAsset.sparkData[3] || 0) * 0.35}, 86 ${104 - (featuredAsset.sparkData[6] || 0) * 0.34} C 124 ${112 - (featuredAsset.sparkData[10] || 0) * 0.36}, 160 ${108 - (featuredAsset.sparkData[14] || 0) * 0.34}, 196 ${95 - (featuredAsset.sparkData[18] || 0) * 0.34} C 232 ${98 - (featuredAsset.sparkData[22] || 0) * 0.32}, 270 ${80 - (featuredAsset.sparkData[25] || 0) * 0.3}, 340 ${72 - (featuredAsset.sparkData[Math.min(29, featuredAsset.sparkData.length - 1)] || 0) * 0.3}`}
                      fill="none"
                      stroke="url(#featuredLine)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-black/10 bg-black/[0.04] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Confidence</p>
                  <p className="mt-2 text-xl font-semibold">{featuredAsset.confidence}</p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/[0.04] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Risk band</p>
                  <p className="mt-2 text-xl font-semibold">{featuredAsset.riskBand}</p>
                </div>
                <button
                  onClick={() => void openAssetDetails(featuredAsset)}
                  className="rounded-2xl border border-cyan-300/30 bg-gradient-to-b from-cyan-300/15 to-cyan-500/5 p-3 text-left transition-colors hover:from-cyan-300/20 hover:to-cyan-500/10"
                >
                  <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">Open</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-base font-semibold">Open analysis</p>
                    <ArrowUpRight size={16} className="text-cyan-200" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Tracked assets</p>
            <h2 className="mt-1 text-2xl font-semibold md:text-3xl">Explore your tracked assets</h2>
          </div>
          <p className="text-sm text-muted-foreground md:max-w-md md:text-right">Open any card for full context, chart behavior, and risk signals.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {assets.map((asset, index) => (
            <CryptoCard key={asset.symbol} {...asset} index={index} onClick={() => void openAssetDetails(asset)} />
          ))}
        </div>
      </section>

      <AnimatePresence>{selectedAsset && <AssetDetailView asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}</AnimatePresence>
    </>
  );
};

export default Index;
