import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CryptoCard from "@/components/CryptoCard";
import AssetDetailView from "@/components/AssetDetailView";
import { cryptoAssets } from "@/data/cryptoData";
import { fetchCandles, fetchDashboardAssets, type CandlePoint, type DashboardAsset } from "@/lib/marketApi";

type SelectedAsset = DashboardAsset & { candles?: CandlePoint[] };

const Wallet = () => {
  const [assets, setAssets] = useState<DashboardAsset[]>(
    cryptoAssets.map((asset) => ({
      ...asset,
      sparkData: [...asset.sparkData],
    }))
  );
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const liveAssets = await fetchDashboardAssets();
        if (liveAssets.length > 0) {
          setAssets(liveAssets);
        }
      } catch (error) {
        console.error("Dashboard API unavailable, using fallback assets:", error);
      }
    };

    void loadAssets();
  }, []);

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

  return (
    <>
      {/* Container for the whole page */}
      <section className="relative mx-auto max-w-5xl h-[calc(100vh-8rem)] flex flex-col">
        
        {/* Fixed Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4 shrink-0 flex flex-col gap-2"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-500 font-semibold drop-shadow-md">My Portfolio</p>
            <h1 className="mt-1 text-3xl font-bold md:text-4xl tracking-tight text-foreground">Wallet Tracked Assets</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Scroll down to view each tracked asset in detail. Open any card for full market context, AI risk signals, and charts.
          </p>
        </motion.div>

        {/* Snap Scroll Container */}
        <div className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth rounded-[32px] border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] shadow-inner relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          {/* Scroll Indicator Dots */}
          <motion.div
            className="sticky top-1/2 right-4 float-right -translate-y-1/2 z-50 flex flex-col gap-2 p-4 pointer-events-none hidden sm:flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {assets.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-6 rounded-full bg-black/10 dark:bg-white/10 transition-all duration-300"
              />
            ))}
          </motion.div>

          {/* Cards */}
          {assets.map((asset) => (
            <div key={asset.symbol} className="h-full w-full snap-start snap-always flex items-center justify-center p-2 sm:p-6 pb-12 sm:pb-6">
              <div className="w-full max-w-4xl h-full flex flex-col justify-center">
                <CryptoCard {...asset} index={0} onClick={() => void openAssetDetails(asset)} />
              </div>
            </div>
          ))}
          
        </div>
      </section>

      <AnimatePresence>
        {selectedAsset && <AssetDetailView asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}
      </AnimatePresence>
    </>
  );
};

export default Wallet;
