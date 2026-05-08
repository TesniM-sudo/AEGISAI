import { Outlet } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import Footer from "./Footer";
import TickerTape from "./TickerTape";
import BackgroundSparks from "./BackgroundSparks";

const Layout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen bg-background text-foreground selection:bg-cyan-500/30">
      {/* Background elements */}
      <div 
        className="fixed inset-0 bg-image-overlay pointer-events-none z-0"
        style={{ backgroundImage: 'url("/terminal-bg.png")' }}
      />
      <BackgroundSparks />
      <div className="pointer-events-none fixed inset-0 cyber-grid z-0" />
      <div className="pointer-events-none fixed inset-0 hud-scanlines opacity-[0.4] z-0" />
      
      {/* Glass Orbs - Increased opacity slightly for more vibrant professional feel */}
      <div className="pointer-events-none fixed left-[10%] top-[10%] h-[500px] w-[500px] rounded-full glass-orb opacity-[0.15] z-0" />
      <div className="pointer-events-none fixed right-[-5%] top-[20%] h-[400px] w-[400px] rounded-full glass-orb opacity-[0.12] [--primary:270_80%_60%] z-0" />
      <div className="pointer-events-none fixed bottom-[5%] left-[20%] h-[500px] w-[500px] rounded-full glass-orb opacity-[0.12] [--primary:140_80%_50%] z-0" />
      
      {/* Gradients */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(49,212,255,0.06),transparent_40%),radial-gradient(circle_at_bottom,rgba(255,180,80,0.04),transparent_40%)] z-0" />

      {/* Sidebar Toggle Button */}
      {!mobileSidebarOpen && (
        <motion.button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="fixed top-3 left-4 z-[65] p-2 rounded-lg hover:bg-muted/30 transition-colors lg:left-6"
          animate={{
            rotate: 0
          }}
          transition={{
            rotate: { duration: 0.5, ease: "easeOut" }
          }}
        >
          <img src="/aegisai-logo.png" alt="AegisAI" className="h-16 w-auto object-contain" />
        </motion.button>
      )}

      {/* Global Ticker */}
      <div className={`fixed left-0 right-0 top-0 z-[60] ${mobileSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <TickerTape />
      </div>

      <Sidebar mobileSidebarOpen={mobileSidebarOpen} setMobileSidebarOpen={setMobileSidebarOpen} />

      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-background/70 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Main Content Area */}
      <div className={`flex w-full flex-col ${mobileSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'} relative z-10`}>
        <main className="flex-1 px-4 pb-28 pt-20 sm:px-6 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
        <Footer />
      </div>

      <MobileNav />
    </div>
  );
};

export default Layout;
