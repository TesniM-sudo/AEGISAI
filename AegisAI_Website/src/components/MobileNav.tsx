import { Link, useLocation } from "react-router-dom";
import { Home, Wallet, Activity, User } from "lucide-react";
import { motion } from "framer-motion";

const MobileNav = () => {
  const location = useLocation();

  const navItems = [
    { name: "Home", path: "/home", icon: Home },
    { name: "Wallet", path: "/wallet", icon: Wallet },
    { name: "Trade", path: "/trade", icon: Activity },
    { name: "Account", path: "/account", icon: User },
  ];

  return (
    <motion.nav 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-[70] flex items-center justify-around border-t border-black/10 bg-background/90 px-4 pb-5 pt-3 backdrop-blur-xl dark:border-white/10 lg:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center gap-1.5 p-2 transition-all active:scale-95"
          >
            <div className={`relative flex items-center justify-center rounded-xl p-2 transition-colors ${isActive ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" : "text-muted-foreground hover:text-foreground"}`}>
              <item.icon className="h-5 w-5" />
              {isActive && (
                <motion.div layoutId="mobileNavIndicator" className="absolute -bottom-3 h-1 w-1 rounded-full bg-cyan-500 dark:bg-cyan-400" />
              )}
            </div>
            <span className={`text-[10px] font-semibold tracking-wider ${isActive ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground"}`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </motion.nav>
  );
};

export default MobileNav;
