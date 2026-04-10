import { Link } from "react-router-dom";
import { Github, Twitter, Linkedin, Heart } from "lucide-react";

const Footer = () => {
  return (
    <footer className="relative z-10 w-full border-t border-black/10 bg-background/50 backdrop-blur-md dark:border-white/5">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 md:px-10">
        <div className="grid gap-8 xl:grid-cols-3 xl:gap-12">
          <div className="flex flex-col xl:col-span-1">
            <Link to="/" className="flex items-center gap-3">
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
              <a href="#" className="text-muted-foreground transition hover:text-cyan-400">
                <span className="sr-only">Twitter</span>
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground transition hover:text-emerald-400">
                <span className="sr-only">GitHub</span>
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground transition hover:text-indigo-400">
                <span className="sr-only">LinkedIn</span>
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 xl:col-span-2">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">Platform</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li><Link to="/" className="text-muted-foreground transition hover:text-cyan-400">Dashboard</Link></li>
                <li><Link to="/trade" className="text-muted-foreground transition hover:text-cyan-400">Trade Hub</Link></li>
                <li><Link to="/account" className="text-muted-foreground transition hover:text-cyan-400">Account</Link></li>
                <li><a href="#" className="text-muted-foreground transition hover:text-cyan-400">AegisAI</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">Resources</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li><a href="#" className="text-muted-foreground transition hover:text-emerald-400">Documentation</a></li>
                <li><a href="#" className="text-muted-foreground transition hover:text-emerald-400">API Reference</a></li>
                <li><a href="#" className="text-muted-foreground transition hover:text-emerald-400">Community</a></li>
                <li><a href="#" className="text-muted-foreground transition hover:text-emerald-400">Market Insights</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">Company</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li><a href="#" className="text-muted-foreground transition hover:text-indigo-400">About</a></li>
                <li><a href="#" className="text-muted-foreground transition hover:text-indigo-400">Security</a></li>
                <li><a href="#" className="text-muted-foreground transition hover:text-indigo-400">Terms of Service</a></li>
                <li><a href="#" className="text-muted-foreground transition hover:text-indigo-400">Privacy Policy</a></li>
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
