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
      className="relative"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[32px] opacity-0 transition-opacity duration-500 hover:opacity-100"
        style={{ background: `radial-gradient(circle at top right, ${color}22 0%, transparent 65%)` }}
      />
      <Tilt
        tiltMaxAngleX={isMobile ? 0 : 4}
        tiltMaxAngleY={isMobile ? 0 : 4}
        perspective={1200}
        glareEnable={!isMobile}
        glareMaxOpacity={0.06}
        glareBorderRadius="32px"
        transitionSpeed={1500}
        scale={isMobile ? 1 : 1.005}
      >
        <div className={`glass-card ${glowClass} relative min-h-[340px] w-full rounded-[32px] border border-white/10 p-4 text-left transition-all hover:border-white/20 sm:min-h-[390px] sm:p-6`}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10" style={{ background: `${color}1a` }}>
                <Shield size={17} style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">{name}</p>
                <p className="mt-1 text-xl font-semibold text-foreground/90">{symbol}</p>
              </div>
            </div>
            <span className="self-start rounded-full border border-white/10 px-3 py-1 text-[11px] text-muted-foreground">Confidence {confidence}</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Signal overview</p>
              <p className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{price}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium" style={{ color: changePositive ? "hsl(142 70% 50%)" : "hsl(0 70% 55%)" }}>
                  {change}
                </span>
                <span className="text-xs text-muted-foreground">24h movement</span>
                <div className="ml-auto flex items-center gap-1">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] ${changePositive ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-200" : "border-white/15 bg-white/[0.03] text-muted-foreground"}`}
                  >
                    UP
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] ${!changePositive ? "border-red-300/35 bg-red-300/15 text-red-200" : "border-white/15 bg-white/[0.03] text-muted-foreground"}`}
                  >
                    DOWN
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Risk band</p>
                  <p className="mt-2 text-base font-semibold">{riskBand}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Portfolio fit</p>
                  <p className="mt-2 text-base font-semibold">{balance}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToTrade("buy")}
                  className="rounded-xl border border-emerald-300/35 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 transition hover:bg-emerald-300/20"
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => goToTrade("sell")}
                  className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200 transition hover:bg-amber-300/20"
                >
                  Sell
                </button>
              </div>

              <p className="mt-5 text-sm leading-7 text-foreground/75">{outlook}</p>
            </div>

            <div className="flex flex-col justify-between gap-4">
              <div className="rounded-[26px] border border-white/10 bg-black/10 p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-2 text-foreground/80">
                  <Activity size={14} style={{ color }} />
                  <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Momentum curve</span>
                </div>
                <SparklineChart data={sparkData} color={color} width={300} height={130} />
              </div>

              <button
                type="button"
                onClick={onClick}
                className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.07]"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Open details</p>
                  <p className="mt-2 text-base font-semibold text-foreground/90">AI brief</p>
                </div>
                <ArrowRight size={18} className="text-foreground/65" />
              </button>
            </div>
          </div>
        </div>
      </Tilt>
    </motion.div>
  );
};

export default CryptoCard;

