import { useEffect, useState } from "react";

import { cryptoAssets } from "@/data/cryptoData";
import { fetchDashboardAssets, type DashboardAsset } from "@/lib/marketApi";

const fallbackAssets: DashboardAsset[] = cryptoAssets.map((asset) => ({
  ...asset,
  sparkData: [...asset.sparkData],
}));

const TickerTape = () => {
  const [assets, setAssets] = useState<DashboardAsset[]>(fallbackAssets);

  useEffect(() => {
    let isMounted = true;

    const loadAssets = async () => {
      try {
        const liveAssets = await fetchDashboardAssets();
        if (isMounted && liveAssets.length > 0) {
          setAssets(liveAssets);
        }
      } catch (error) {
        console.warn("Ticker API unavailable, using fallback prices:", error);
      }
    };

    void loadAssets();
    const intervalId = window.setInterval(() => void loadAssets(), 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const tickerItems = [...assets, ...assets];

  return (
    <div className="ticker-wrap border-b border-white/5 bg-black/60 shadow-lg">
      <ul className="ticker-move" aria-label="Market ticker">
        {tickerItems.map((asset, index) => (
          <li key={`${asset.symbol}-${index}`} className="ticker-item">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
              {asset.symbol}
            </span>
            <span className="font-mono text-xs font-bold tabular-nums text-foreground">
              {asset.price}
            </span>
            <span
              className={`text-[10px] font-bold tabular-nums ${
                asset.changePositive ? "text-emerald-400" : "text-rose-500"
              }`}
            >
              {asset.changePositive ? "\u25B2" : "\u25BC"} {asset.change}
            </span>
            <span className="h-1 w-1 rounded-full bg-white/10" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TickerTape;
