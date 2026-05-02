import { Link } from "react-router-dom";
import { Github, Heart, Phone, Mail, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="relative z-10 w-full border-t border-black/10 bg-background/50 backdrop-blur-md dark:border-white/5">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 md:px-10">
        <div className="grid gap-8 xl:grid-cols-4 xl:gap-12">
          <div className="flex flex-col xl:col-span-1">
            <Link to="/home" className="flex items-center gap-3">
              <img
                src="/aegisai-logo.png"
                alt="AegisAI mark"
                className="h-[80px] w-auto object-contain drop-shadow-[0_0_8px_rgba(37,99,235,0.2)] md:h-[96px]"
              />
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">AegisAI</p>
                <p className="text-xs font-semibold text-foreground/90">Platform</p>
              </div>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground/80 max-w-xs leading-relaxed">
              The most intelligent way to track your holdings, identify risks, and get actionable insights with our AegisAI.
            </p>
            <div className="mt-6 flex space-x-4">
              <a href="https://github.com/TesniM-sudo/AEGISAI/tree/master" className="text-muted-foreground transition hover:text-emerald-400">
                <span className="sr-only">GitHub</span>
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 xl:col-span-3">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">Platform</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li><Link to="/home" className="text-muted-foreground transition hover:text-cyan-400">Home</Link></li>
                <li><Link to="/wallet" className="text-muted-foreground transition hover:text-cyan-400">Wallet</Link></li>
                <li><Link to="/trade" className="text-muted-foreground transition hover:text-cyan-400">Trade</Link></li>
                <li><Link to="/account" className="text-muted-foreground transition hover:text-cyan-400">Account</Link></li>
                <li><Link to="/admin/history" className="text-muted-foreground transition hover:text-cyan-400">Admin</Link></li>
                <li><Link to="/contact" className="text-muted-foreground transition hover:text-cyan-400">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">Account</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li><Link to="/account" className="text-muted-foreground transition hover:text-cyan-400">Profile</Link></li>
                <li><Link to="/account" className="text-muted-foreground transition hover:text-cyan-400">Settings</Link></li>
                <li><Link to="/" className="text-muted-foreground transition hover:text-red-400">Sign Out</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">Contact</h3>
              <ul className="mt-4 space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">1-800-AEGIS-AI</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">contact@aegisai.com</span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">123 Market St, SF, CA</span>
                </li>
                <li className="pt-2">
                  <Link to="/contact" className="text-cyan-500 hover:text-cyan-400 font-medium transition">Get in touch &rarr;</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between border-t border-black/10 pt-8 dark:border-white/5 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} AegisAI Platform. All rights reserved.
          </p>
          <p className="mt-4 flex items-center text-xs text-muted-foreground sm:mt-0">
            Intelligently crafted with <Heart className="mx-1 h-3 w-3 text-rose-500" /> for the future.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
