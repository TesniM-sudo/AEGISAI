import { cryptoAssets } from "@/data/cryptoData";

const TickerTape = () => {
  // Triple the assets to ensure smooth infinite loop
  const tickerItems = [...cryptoAssets, ...cryptoAssets, ...cryptoAssets];

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
