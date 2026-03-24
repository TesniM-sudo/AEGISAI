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

const generateCandles = (seed: number, count = 40): Candle[] => {
  const candles: Candle[] = [];
  let price = seed;
  for (let i = 0; i < count; i++) {
    const change = (Math.sin(i * 0.3 + seed * 0.1) * 3 + (Math.random() - 0.5) * 4);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    candles.push({ open, high, low, close });
    price = close;
  }
  return candles;
};

const CandlestickChart = ({ color, candles: providedCandles, width = 600, height = 300 }: CandlestickChartProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const candles = useMemo(
    () => (providedCandles && providedCandles.length > 1 ? providedCandles : generateCandles(50)),
    [providedCandles]
  );

  const allValues = candles.flatMap(c => [c.high, c.low]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const candleWidth = (width - 20) / candles.length;
  const gap = candleWidth * 0.3;
  const bodyWidth = candleWidth - gap;

  const yScale = (val: number) => height - 20 - ((val - min) / range) * (height - 40);

  // Price levels for grid
  const levels = 5;
  const priceStep = range / levels;
  const hovered = hoveredIndex !== null ? candles[hoveredIndex] : null;

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
          <line
            key={i}
            x1={10}
            y1={y}
            x2={width - 10}
            y2={y}
            stroke="hsla(0,0%,100%,0.05)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Candles */}
      {candles.map((candle, i) => {
        const x = 10 + i * candleWidth + gap / 2;
        const isGreen = candle.close >= candle.open;
        const bodyTop = yScale(Math.max(candle.open, candle.close));
        const bodyBottom = yScale(Math.min(candle.open, candle.close));
        const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
        const wickX = x + bodyWidth / 2;

        const fillColor = isGreen ? "hsl(142, 70%, 50%)" : "hsl(0, 70%, 55%)";
        const fillOpacity = isGreen ? 0.9 : 0.9;

        return (
          <g
            key={i}
            filter="url(#candle-glow)"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <title>
              {`O ${candle.open.toFixed(2)} | H ${candle.high.toFixed(2)} | L ${candle.low.toFixed(2)} | C ${candle.close.toFixed(2)}`}
            </title>
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
            x1={10}
            y1={yScale(candles[candles.length - 1].close)}
            x2={width - 10}
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
            x1={10 + hoveredIndex * candleWidth + gap / 2 + bodyWidth / 2}
            y1={20}
            x2={10 + hoveredIndex * candleWidth + gap / 2 + bodyWidth / 2}
            y2={height - 20}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={0.8}
            strokeDasharray="3 4"
          />
          <rect
            x={12}
            y={10}
            width={220}
            height={42}
            rx={8}
            fill="rgba(15,18,25,0.82)"
            stroke="rgba(255,255,255,0.12)"
          />
          <text x={20} y={27} fill="#E8F7FF" fontSize={10} fontFamily="Inter">
            {`O ${hovered.open.toFixed(2)}  H ${hovered.high.toFixed(2)}  L ${hovered.low.toFixed(2)}  C ${hovered.close.toFixed(2)}`}
          </text>
          {hovered.date && (
            <text x={20} y={41} fill="rgba(232,247,255,0.7)" fontSize={9} fontFamily="Inter">
              {hovered.date}
            </text>
          )}
        </>
      )}
    </svg>
  );
};

export default CandlestickChart;
