import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("admin@aegisai.com");
  const [password, setPassword] = useState("admin123");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Set a mock session in localStorage so that other pages recognize the user as logged in
    const sessionData = {
      email,
      role: "trader",
      sessionToken: "mock-session-token-" + Date.now(),
    };
    localStorage.setItem("aegis_account_session_v2", JSON.stringify(sessionData));

    navigate("/home");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Background effects matching Layout.tsx */}
      <div 
        className="fixed inset-0 bg-image-overlay pointer-events-none z-0"
        style={{ backgroundImage: 'url("/terminal-bg.png")' }}
      />
      <div className="pointer-events-none fixed inset-0 cyber-grid z-0" />
      <div className="pointer-events-none fixed inset-0 hud-scanlines opacity-[0.4] z-0" />
      
      {/* Glass Orbs for background glow */}
      <div className="pointer-events-none fixed left-[10%] top-[10%] h-[500px] w-[500px] rounded-full glass-orb opacity-[0.15] z-0" />
      <div className="pointer-events-none fixed right-[-5%] bottom-[10%] h-[400px] w-[400px] rounded-full glass-orb opacity-[0.1] [--primary:270_80%_60%] z-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="glass-card premium-border relative z-10 w-full max-w-md rounded-[32px] p-8 sm:p-10 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/aegisai-logo.png"
            alt="AegisAI Logo"
            className="mb-6 h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]"
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome Back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Log in to your AegisAI dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground ml-1">Email Address</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 pl-11 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-cyan-500/50 focus:bg-black/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 dark:bg-white/5 dark:focus:bg-white/10"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground ml-1">Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 pl-11 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-cyan-500/50 focus:bg-black/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 dark:bg-white/5 dark:focus:bg-white/10"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-white/20 bg-black/20 text-cyan-500 focus:ring-cyan-500" />
              <span className="text-muted-foreground">Remember me</span>
            </label>
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">Forgot password?</a>
          </div>

          <button
            type="submit"
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-cyan-500 px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-cyan-400 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-background money-glow-emerald mt-6"
          >
            <span className="relative z-10">Access Platform</span>
            <ArrowRight size={18} className="relative z-10 transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Don't have an account? <a href="#" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">Request Access</a>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
