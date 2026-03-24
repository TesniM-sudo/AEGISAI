import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Bot, Sparkles, ArrowUpRight, BrainCircuit, LineChart } from "lucide-react";
import { Link } from "react-router-dom";
import CryptoCard from "@/components/CryptoCard";
import AssetDetailView from "@/components/AssetDetailView";
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
  const [featuredSymbol, setFeaturedSymbol] = useState(cryptoAssets[0].symbol);
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
      const candles = await fetchCandles(asset.symbol);
      setSelectedAsset({ ...asset, candles });
      return;
    } catch (error) {
      console.error(`Failed to load candles for ${asset.symbol}`, error);
    }

    setSelectedAsset(asset);
  };

  if (!featuredAsset) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(49,212,255,0.14),transparent_26%),radial-gradient(circle_at_78%_18%,rgba(111,73,255,0.14),transparent_28%),radial-gradient(circle_at_bottom,rgba(255,180,80,0.10),transparent_30%)]" />

      <motion.header
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-4 backdrop-blur-md md:px-6 md:py-5"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.15 }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <img
              src="/aegisai-logo.png"
              alt="AegisAI mark"
              className="h-12 w-10 object-contain drop-shadow-[0_0_12px_rgba(37,99,235,0.35)] md:h-14 md:w-12"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">AegisAI</p>
            <p className="text-xs font-semibold text-foreground/90 sm:text-sm">Investment Intelligence Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="glass-card hidden items-center gap-3 rounded-full px-3 py-2 md:flex">
            <Bot size={14} className="text-cyan-300" />
            <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">AI help in plain language</span>
          </div>
          <Link
            to="/account"
            className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Account
          </Link>
        </div>
      </motion.header>

      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-24 sm:px-6 md:px-10 md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-10 grid items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="flex flex-col justify-between py-2 md:py-4">
            <div>
              <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-[11px] sm:tracking-[0.3em]">
                <Sparkles size={12} className="text-cyan-300" />
                Clear signals, explained like a real teammate.
              </div>
              <h1 className="max-w-4xl text-3xl font-semibold leading-[0.95] tracking-tight sm:text-4xl md:text-6xl">
                AegisAI helps you understand the market without the noise.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                Follow your assets, spot risk quickly, and get concise explanations you can actually use.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="glass-card rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2 text-cyan-300">
                  <ShieldCheck size={14} />
                  <span className="text-[10px] uppercase tracking-[0.24em]">Trust layer</span>
                </div>
                <p className="text-sm leading-6 text-foreground/85">Risk and confidence are always visible first.</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2 text-violet-300">
                  <BrainCircuit size={14} />
                  <span className="text-[10px] uppercase tracking-[0.24em]">AI guidance</span>
                </div>
                <p className="text-sm leading-6 text-foreground/85">Start simple, then dive deeper only when you want.</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2 text-amber-300">
                  <LineChart size={14} />
                  <span className="text-[10px] uppercase tracking-[0.24em]">Market view</span>
                </div>
                <p className="text-sm leading-6 text-foreground/85">Clean charts and cards that make decisions faster.</p>
              </div>
            </div>
          </div>

          <div className="glass-card flex flex-col justify-between rounded-[30px] p-4 sm:p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Featured market board</p>
                <p className="mt-1 text-base font-semibold text-foreground/95">What matters right now</p>
              </div>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-medium text-cyan-200 sm:text-right">
                {isLiveData ? "Live DB data" : "Fallback demo data"}
              </span>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {assets.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => setFeaturedSymbol(asset.symbol)}
                  className={`rounded-full border px-3 py-2 text-xs transition-all ${featuredAsset.symbol === asset.symbol ? "border-cyan-200/40 bg-cyan-300/15 text-foreground shadow-[0_10px_24px_-14px_rgba(34,211,238,0.7)]" : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground"}`}
                >
                  {asset.symbol}
                </button>
              ))}
            </div>

            <div className="rounded-[24px] border border-white/15 bg-black/25 p-3 sm:p-4">
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

              <div className="mb-4 rounded-[20px] border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Price momentum</p>
                  <div className="flex items-center gap-1">
                    {["1H", "24H", "7D"].map((label, idx) => (
                      <span
                        key={label}
                        className={`rounded-md px-2 py-1 text-[10px] ${idx === 1 ? "bg-white/15 text-foreground" : "bg-white/[0.05] text-muted-foreground"}`}
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
                      d={`M 10 128 C 42 124, 58 ${100 - featuredAsset.sparkData[3] * 0.35}, 86 ${104 - featuredAsset.sparkData[6] * 0.34} C 124 ${112 - featuredAsset.sparkData[10] * 0.36}, 160 ${108 - featuredAsset.sparkData[14] * 0.34}, 196 ${95 - featuredAsset.sparkData[18] * 0.34} C 232 ${98 - featuredAsset.sparkData[22] * 0.32}, 270 ${80 - featuredAsset.sparkData[25] * 0.3}, 340 ${72 - featuredAsset.sparkData[29] * 0.3} L 340 170 L 10 170 Z`}
                      fill="url(#featuredArea)"
                    />
                    <path
                      d={`M 10 128 C 42 124, 58 ${100 - featuredAsset.sparkData[3] * 0.35}, 86 ${104 - featuredAsset.sparkData[6] * 0.34} C 124 ${112 - featuredAsset.sparkData[10] * 0.36}, 160 ${108 - featuredAsset.sparkData[14] * 0.34}, 196 ${95 - featuredAsset.sparkData[18] * 0.34} C 232 ${98 - featuredAsset.sparkData[22] * 0.32}, 270 ${80 - featuredAsset.sparkData[25] * 0.3}, 340 ${72 - featuredAsset.sparkData[29] * 0.3}`}
                      fill="none"
                      stroke="url(#featuredLine)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Confidence</p>
                  <p className="mt-2 text-xl font-semibold">{featuredAsset.confidence}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
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
    </div>
  );
};

export default Index;
