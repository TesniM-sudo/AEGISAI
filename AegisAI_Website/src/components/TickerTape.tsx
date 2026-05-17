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
        console.error("Ticker API unavailable, using fallback assets:", error);
      }
    };

    void loadAssets();
    const intervalId = window.setInterval(() => void loadAssets(), 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const tickerItems = [...assets, ...assets, ...assets];

  return (
    <div className="ticker-wrap border-b border-white/5 bg-black/60 shadow-lg">
      <div className="ticker-move">
        {tickerItems.map((asset, index) => (
          <div key={`${asset.symbol}-${index}`} className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">{asset.symbol}</span>
              <span className="text-xs font-bold font-mono text-foreground">{asset.price}</span>
              <span
                className={`text-[10px] font-bold ${asset.changePositive ? "text-emerald-400" : "text-rose-500"}`}
              >
                {asset.changePositive ? "▲" : "▼"} {asset.change}
              </span>
            </span>
            <div className="h-1 w-1 rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TickerTape;
