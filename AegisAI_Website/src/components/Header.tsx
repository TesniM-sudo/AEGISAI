import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const Header = () => {
  return (
    <motion.header
      className="fixed left-0 right-0 top-8 z-50 flex items-center justify-between px-4 py-4 backdrop-blur-md md:px-6 md:py-5"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.15 }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div>
          <Link to="/">
              <img
                src="/aegisai-logo.png"
                alt="AegisAI mark"
                className="h-[80px] w-auto object-contain drop-shadow-[0_0_12px_rgba(37,99,235,0.35)] dark:drop-shadow-[0_0_12px_rgba(37,99,235,0.35)] drop-shadow-[0_0_12px_rgba(0,0,0,0.1)] md:h-[96px] scale-[1.2] md:scale-[1.25] origin-left"
              />
          </Link>
        </div>
        <div className="hidden min-w-0 md:flex flex-col justify-center ml-4">
          <p className="text-xs md:text-sm uppercase tracking-[0.35em] text-muted-foreground font-semibold">AegisAI</p>
          <p className="text-sm font-bold text-foreground/90 sm:text-base md:text-lg tracking-tight mt-0.5">Investment Intelligence Platform</p>
        </div>
      </div>

      {/* Center Section: Trade & Contact */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3">
        <Link
          to="/trade"
          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 transition hover:bg-emerald-500/20 dark:border-emerald-300/35 dark:bg-emerald-300/10 dark:text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
        >
          Trade
        </Link>
        <Link
          to="/contact"
          className="hidden rounded-full border border-black/10 bg-black/5 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-foreground transition hover:bg-black/10 dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10 sm:block"
        >
          Contact
        </Link>
      </div>

      {/* Right Section: Navigation & Theme Toggle */}
      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
        <Link
          to="/account"
          className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700 transition hover:bg-cyan-500/20 dark:border-cyan-300/35 dark:bg-cyan-300/10 dark:text-cyan-100"
        >
          Account
        </Link>
        <div className="ml-2 border-l border-black/10 pl-4 dark:border-white/10">
          <ThemeToggle />
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
