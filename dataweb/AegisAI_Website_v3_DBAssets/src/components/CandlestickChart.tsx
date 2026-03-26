import { useMemo, useState } from "react";

export interface Candle {
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
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

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="candle-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle grid lines */}
      {Array.from({ length: levels + 1 }).map((_, i) => {
        const y = yScale(min + i * priceStep);
        return (
          <line key={i} x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="hsla(0,0%,100%,0.05)" strokeWidth={0.5} />
        );
      })}

      {/* Mouse interaction layer */}
      <rect
        x={plotLeft}
        y={plotTop}
        width={plotWidth}
        height={plotBottom - plotTop}
        fill="transparent"
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
        const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
        const wickX = centerX;

        const fillColor = isGreen ? "hsl(142, 70%, 50%)" : "hsl(0, 70%, 55%)";
        const fillOpacity = isGreen ? 0.9 : 0.9;

        return (
          <g key={i} filter="url(#candle-glow)">
            {/* Wick */}
            <line
              x1={wickX}
              y1={yScale(candle.high)}
              x2={wickX}
              y2={yScale(candle.low)}
              stroke={fillColor}
              strokeWidth={0.8}
              opacity={0.6}
            />
            {/* Body */}
            <rect
              x={x}
              y={bodyTop}
              width={bodyWidth}
              height={bodyHeight}
              fill={fillColor}
              opacity={fillOpacity}
              rx={1}
            />
          </g>
        );
      })}

      {/* Current price line */}
      {candles.length > 0 && (
        <>
          <line
            x1={plotLeft}
            y1={yScale(candles[candles.length - 1].close)}
            x2={plotRight}
            y2={yScale(candles[candles.length - 1].close)}
            stroke={color}
            strokeWidth={0.5}
            strokeDasharray="4 4"
            opacity={0.5}
          />
          <text
            x={width - 12}
            y={yScale(candles[candles.length - 1].close) - 4}
            fill={color}
            fontSize={9}
            textAnchor="end"
            fontFamily="Inter"
            opacity={0.7}
          >
            {candles[candles.length - 1].close.toFixed(2)}
          </text>
        </>
      )}

      {/* Hover guide + value panel */}
      {hovered && hoveredIndex !== null && (
        <>
          <line
            x1={xCenter(hoveredIndex)}
            y1={plotTop}
            x2={xCenter(hoveredIndex)}
            y2={plotBottom}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={0.8}
            strokeDasharray="3 4"
          />
          <rect
            x={12}
            y={10}
            width={250}
            height={54}
            rx={8}
            fill="rgba(15,18,25,0.82)"
            stroke="rgba(255,255,255,0.12)"
          />
          <text x={20} y={27} fill="#E8F7FF" fontSize={10} fontFamily="Inter">
            {`Worth: ${formatMoney(hovered.close)}  Date: ${formatDate(hovered.date)}`}
          </text>
          <text x={20} y={44} fill="rgba(232,247,255,0.72)" fontSize={9} fontFamily="Inter">
            {`O ${hovered.open.toFixed(2)}  H ${hovered.high.toFixed(2)}  L ${hovered.low.toFixed(2)}  C ${hovered.close.toFixed(2)}`}
          </text>
        </>
      )}
    </svg>
  );
};

export default CandlestickChart;
