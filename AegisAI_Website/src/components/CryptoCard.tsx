import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";
import { Shield, ArrowRight, Activity } from "lucide-react";
import Tilt from "react-parallax-tilt";
import { useNavigate } from "react-router-dom";
import SparklineChart from "./SparklineChart";

interface CryptoCardProps {
  symbol: string;
  name: string;
  balance: string;
  price: string;
  change: string;
  changePositive: boolean;
  sparkData: number[];
  color: string;
  glowClass: string;
  index: number;
  outlook: string;
  riskBand: string;
  confidence: string;
  sentiment?: string;
  volatility?: string;
  marketCap?: string;
  onClick?: () => void;
}

const CryptoCard = ({
  symbol,
  name,
  balance,
  price,
  change,
  changePositive,
  sparkData,
  color,
  glowClass,
  index,
  outlook,
  riskBand,
  confidence,
  sentiment,
  volatility,
  marketCap,
  onClick,
}: CryptoCardProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const goToTrade = (side: "buy" | "sell") => {
    navigate(`/trade?symbol=${encodeURIComponent(symbol)}&side=${side}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
      viewport={{ once: true, amount: 0.18 }}
      className="group relative"
    >
      <div
        className="pointer-events-none absolute -inset-4 rounded-[40px] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at center, ${color}15 0%, transparent 70%)` }}
      />
      <Tilt
        tiltMaxAngleX={isMobile ? 0 : 5}
        tiltMaxAngleY={isMobile ? 0 : 5}
        perspective={1500}
        glareEnable={!isMobile}
        glareMaxOpacity={0.1}
        glareColor="#ffffff"
        glarePosition="all"
        glareBorderRadius="32px"
        transitionSpeed={2000}
        scale={isMobile ? 1 : 1.02}
      >
        <div className={`glass-card premium-border ${glowClass} relative min-h-[420px] w-full rounded-[32px] border border-white/10 p-5 text-left transition-all hover:border-white/30 sm:p-7 shadow-xl group-hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] ${changePositive ? "hover:profit-flash" : ""}`}>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 shadow-lg" style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)` }}>
                <Shield size={20} style={{ color }} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground/60">{name}</p>
                  {sentiment && (
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan-400/80">
                      {sentiment}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-bold text-foreground">{symbol}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                Confidence {confidence}
              </span>
              {marketCap && (
                <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
                  MCAP: {marketCap}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground/50">Market Intelligence</p>
                {volatility && (
                  <span className="text-[8px] font-mono text-rose-400/60">VOL: {volatility}</span>
                )}
              </div>
              <p className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">{price}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-base font-bold" style={{ color: changePositive ? "#10b981" : "#ef4444" }}>
                  {changePositive ? "+" : ""}{change}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">24h dynamic</span>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">Risk Band</p>
                  <p className="mt-2 text-lg font-bold text-foreground/90">{riskBand}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">Portfolio Fit</p>
                  <p className="mt-2 text-lg font-bold text-foreground/90">{balance}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goToTrade("buy"); }}
                  className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 transition-all hover:bg-emerald-500 hover:text-black active:scale-95 shadow-[0_0_20px_-10px_rgba(16,185,129,0.5)]"
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goToTrade("sell"); }}
                  className="flex-1 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400 transition-all hover:bg-amber-500 hover:text-black active:scale-95"
                >
                  Sell
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6">
              <div className="rounded-[30px] border border-white/10 bg-black/20 p-4 sm:p-5 shadow-inner">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="animate-pulse" style={{ color }} />
                    <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground/50">Live Momentum</span>
                  </div>
                </div>
                <div className="h-[120px] w-full">
                  <SparklineChart data={sparkData} color={color} width={300} height={120} />
                </div>
              </div>

              <button
                type="button"
                onClick={onClick}
                className="group/btn flex items-center justify-between rounded-[28px] border border-white/10 bg-white/[0.04] p-5 transition-all hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.98]"
              >
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground/40">Knowledge Base</p>
                  <p className="mt-1 text-lg font-bold text-foreground/90">AI Intel Brief</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-transform group-hover/btn:translate-x-1">
                  <ArrowRight size={20} className="text-foreground/70" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </Tilt>
    </motion.div>
  );
};

export default CryptoCard;

