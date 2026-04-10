import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import TickerTape from "./TickerTape";
import BackgroundSparks from "./BackgroundSparks";

const Layout = () => {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* Premium Background Elements */}
      <div 
        className="fixed inset-0 bg-image-overlay pointer-events-none"
        style={{ backgroundImage: 'url("/terminal-bg.png")' }}
      />
      <BackgroundSparks />
      <div className="pointer-events-none fixed inset-0 cyber-grid" />
      <div className="pointer-events-none fixed inset-0 hud-scanlines opacity-[0.4]" />
      
      {/* Glass Orbs */}
      <div className="pointer-events-none fixed left-[10%] top-[10%] h-[500px] w-[500px] rounded-full glass-orb opacity-[0.1]" />
      <div className="pointer-events-none fixed right-[-5%] top-[20%] h-[400px] w-[400px] rounded-full glass-orb opacity-[0.1] [--primary:270_80%_60%]" />
      <div className="pointer-events-none fixed bottom-[5%] left-[20%] h-[500px] w-[500px] rounded-full glass-orb opacity-[0.08] [--primary:140_80%_50%]" />
      
      {/* Gradients */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(49,212,255,0.06),transparent_40%),radial-gradient(circle_at_bottom,rgba(255,180,80,0.04),transparent_40%)]" />

      {/* Global Ticker */}
      <div className="fixed left-0 right-0 top-0 z-[60]">
        <TickerTape />
      </div>

      <Header />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 pt-28 pb-10">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

export default Layout;
