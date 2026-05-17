import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Home, Wallet, Activity, User, ShieldAlert, Phone, LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const Sidebar = ({ mobileSidebarOpen, setMobileSidebarOpen }: { mobileSidebarOpen: boolean; setMobileSidebarOpen: (open: boolean) => void }) => {
  const location = useLocation();

  const navItems = [
    { name: "Home", path: "/home", icon: Home },
    { name: "Wallet", path: "/wallet", icon: Wallet },
    { name: "Trade", path: "/trade", icon: Activity },
    { name: "Account", path: "/account", icon: User },
    { name: "Admin", path: "/admin/history", icon: ShieldAlert },
    { name: "Contact", path: "/contact", icon: Phone },
  ];

  return (
    <motion.aside
      className="fixed bottom-0 left-0 top-0 z-50 w-64 flex-col border-r border-black/10 bg-background/80 px-6 py-8 backdrop-blur-md dark:border-white/10 pt-20"
      initial={{ x: -250 }}
      animate={{ x: mobileSidebarOpen ? 0 : -250 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="mb-10 flex items-center justify-center">
        <button onClick={() => setMobileSidebarOpen(false)} className="flex items-center space-x-4 hover:bg-muted/30 rounded-lg p-2 transition-colors" >
          <img
            src="/aegisai-logo.png"
            alt="AegisAI mark"
            style={{ width: "103px", marginLeft: "-45px" }}
            className="w-auto object-contain drop-shadow-[0_0_12px_rgba(37,99,235,0.35)] dark:drop-shadow-[0_0_12px_rgba(37,99,235,0.35)]"
          />
          <p className="font-bold uppercase tracking-[0.15em] text-cyan-600 dark:text-cyan-400" style={{ fontSize: "18px", marginLeft: "0px", textShadow: "0 0 12px rgba(6, 182, 212, 0.3)" }}>
            AEGIS-AI TRADING PLATFORM
          </p>
        </button>
      </div>

      <div className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.3)]"
                  : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
              }`}
            >
              <item.icon
                className={`h-5 w-5 ${
                  isActive ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col gap-6 pt-6">
        <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <Link
          to="/"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Link>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
