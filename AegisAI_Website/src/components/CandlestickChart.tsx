import { useMemo, useState } from "react";

export interface Candle {
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

interface CandlestickChartProps {
  color: string;
  candles?: Candle[];
  width?: number;
  height?: number;
}

const CandlestickChart = ({ color, candles: providedCandles, width = 600, height = 300 }: CandlestickChartProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const candles = useMemo(() => (providedCandles ? providedCandles : []), [providedCandles]);

  if (!candles.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No candle data available.
      </div>
    );
  }

  const allValues = candles.flatMap(c => [c.high, c.low]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const plotLeft = 10;
  const plotRight = width - 10;
  const plotTop = 20;
  const plotBottom = height - 20;
  const plotWidth = plotRight - plotLeft;

  const slotWidth = plotWidth / candles.length;
  const bodyWidth = Math.max(3, Math.min(14, slotWidth * 0.62));

  const yScale = (val: number) => plotBottom - ((val - min) / range) * (plotBottom - plotTop);
  const xCenter = (i: number) => plotLeft + i * slotWidth + slotWidth / 2;

  // Price levels for grid
  const levels = 5;
  const priceStep = range / levels;
  const hovered = hoveredIndex !== null ? candles[hoveredIndex] : null;
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  const formatDate = (value?: string) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };
  const formatDateTime = (value?: string) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
  };
  const formatVolume = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  };

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="hud-scanlines relative">
      <defs>
        <filter id="candle-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="vol-grad-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(142, 70%, 50%)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(142, 70%, 50%)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="vol-grad-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(0, 70%, 55%)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(0, 70%, 55%)" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Technical Grid */}
      {Array.from({ length: 8 }).map((_, i) => {
        const x = plotLeft + (i * plotWidth) / 7;
        return (
          <line key={`v-${i}`} x1={x} y1={plotTop} x2={x} y2={plotBottom} stroke="hsla(0,0%,100%,0.03)" strokeWidth={1} />
        );
      })}
      {Array.from({ length: levels + 1 }).map((_, i) => {
        const y = yScale(min + i * priceStep);
        return (
          <g key={`h-${i}`}>
            <line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="hsla(0,0%,100%,0.05)" strokeWidth={0.5} />
            <text x={plotLeft - 4} y={y + 3} fill="hsla(0,0%,100%,0.2)" fontSize={8} textAnchor="end" fontFamily="monospace">
              {((min + i * priceStep) / 1000).toFixed(1)}k
            </text>
          </g>
        );
      })}

      {/* Volume Bars */}
      {candles.map((candle, i) => {
        const centerX = xCenter(i);
        const vHeight = candle.volume ? (Math.sqrt(candle.volume) / 500) * (height * 0.15) : 0;
        const isGreen = candle.close >= candle.open;
        return (
          <rect
            key={`vol-${i}`}
            x={centerX - bodyWidth / 2.5}
            y={plotBottom - vHeight}
            width={bodyWidth / 1.2}
            height={vHeight}
            fill={isGreen ? "url(#vol-grad-up)" : "url(#vol-grad-down)"}
            rx={1}
          />
        );
      })}

      {/* Mouse interaction layer */}
      <rect
        x={plotLeft}
        y={plotTop}
        width={plotWidth}
        height={plotBottom - plotTop}
        fill="transparent"
        className="cursor-crosshair"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const relX = event.clientX - rect.left;
          const scale = width / rect.width;
          const svgX = relX * scale;
          const idx = Math.max(0, Math.min(candles.length - 1, Math.floor((svgX - plotLeft) / slotWidth)));
          setHoveredIndex(idx);
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      />

      {/* Candles */}
      {candles.map((candle, i) => {
        const centerX = xCenter(i);
        const x = centerX - bodyWidth / 2;
        const isGreen = candle.close >= candle.open;
        const bodyTop = yScale(Math.max(candle.open, candle.close));
        const bodyBottom = yScale(Math.min(candle.open, candle.close));
        const bodyHeight = Math.max(bodyBottom - bodyTop, 1.5);
        const wickX = centerX;

        const fillColor = isGreen ? "hsl(142, 70%, 50%)" : "hsl(0, 70%, 55%)";

        return (
          <g key={i}>
            <line
              x1={wickX}
              y1={yScale(candle.high)}
              x2={wickX}
              y2={yScale(candle.low)}
              stroke={fillColor}
              strokeWidth={1}
              opacity={0.4}
            />
            <rect
              x={x}
              y={bodyTop}
              width={bodyWidth}
              height={bodyHeight}
              fill={fillColor}
              filter={isGreen ? "url(#candle-glow)" : "none"}
              rx={1.5}
            />
          </g>
        );
      })}

      {/* Current Price Tracker */}
      {candles.length > 0 && (
        <g>
          <line
            x1={plotLeft}
            y1={yScale(candles[candles.length - 1].close)}
            x2={plotRight}
            y2={yScale(candles[candles.length - 1].close)}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="2 4"
            className="animate-pulse"
          />
          <rect
            x={plotRight + 2}
            y={yScale(candles[candles.length - 1].close) - 8}
            width={40}
            height={16}
            rx={4}
            fill={color}
          />
          <text
            x={plotRight + 22}
            y={yScale(candles[candles.length - 1].close) + 4}
            fill="black"
            fontSize={9}
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {candles[candles.length - 1].close.toFixed(0)}
          </text>
        </g>
      )}

      {/* Hover Information Panel */}
      {hovered && hoveredIndex !== null && (
        <g>
          <line
            x1={xCenter(hoveredIndex)}
            y1={plotTop}
            x2={xCenter(hoveredIndex)}
            y2={plotBottom}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <foreignObject x={width - 180} y={20} width={160} height={140}>
            <div className="rounded-xl border border-white/10 bg-black/90 p-3 shadow-2xl backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between border-b border-white/5 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{formatDateTime(hovered.date)}</span>
                <span className={`text-[10px] font-bold ${hovered.close >= hovered.open ? "text-emerald-400" : "text-rose-500"}`}>
                  {hovered.close >= hovered.open ? "BUY" : "SELL"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 text-[11px] font-mono">
                <span className="text-muted-foreground">PRICE</span>
                <span className="text-right text-foreground font-bold">{formatMoney(hovered.close)}</span>
                <span className="text-muted-foreground">OPEN</span>
                <span className="text-right text-foreground/80">{formatMoney(hovered.open)}</span>
                <span className="text-muted-foreground">HIGH</span>
                <span className="text-right text-emerald-400">{formatMoney(hovered.high)}</span>
                <span className="text-muted-foreground">LOW</span>
                <span className="text-right text-rose-400">{formatMoney(hovered.low)}</span>
                <span className="text-muted-foreground">VOLUME</span>
                <span className="text-right text-cyan-400">{formatVolume(hovered.volume)}</span>
              </div>
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
};

export default CandlestickChart;
