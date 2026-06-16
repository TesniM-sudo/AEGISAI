import { Mail, Phone, MapPin, Send, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

const Contact = () => {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-10">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-10 text-center"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-500">Get in touch</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">Contact Support</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Have questions about your account, trading limits, or need technical assistance with our AegisAI platform? Our support team is here to help.
        </p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="lg:col-span-2 space-y-6"
        >
          <div className="glass-card premium-border relative overflow-hidden rounded-3xl p-8">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
            
            <h2 className="text-2xl font-semibold mb-6">Contact Information</h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Phone Support</h3>
                  <p className="mt-1 font-semibold text-foreground">1-800-AEGIS-AI</p>
                  <p className="text-xs text-muted-foreground mt-1">Mon-Fri from 8am to 5pm</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Email Support</h3>
                  <p className="mt-1 font-semibold text-foreground">contact@aegisai.com</p>
                  <p className="text-xs text-muted-foreground mt-1">We'll reply within 24 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Office Location</h3>
                  <p className="mt-1 font-semibold text-foreground">123 Market St, Suite 400</p>
                  <p className="text-xs text-muted-foreground mt-1">San Francisco, CA 94105</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="lg:col-span-3"
        >
          <div className="glass-card premium-border rounded-3xl p-8">
            <div className="mb-6 flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-cyan-400" />
              <h2 className="text-2xl font-semibold">Send us a message</h2>
            </div>
            
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground ml-1">First Name</label>
                  <input
                    type="text"
                    className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-cyan-500/50 focus:bg-black/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 dark:bg-white/5 dark:focus:bg-white/10"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground ml-1">Last Name</label>
                  <input
                    type="text"
                    className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-cyan-500/50 focus:bg-black/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 dark:bg-white/5 dark:focus:bg-white/10"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground ml-1">Email Address</label>
                <input
                  type="email"
                  className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-cyan-500/50 focus:bg-black/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 dark:bg-white/5 dark:focus:bg-white/10"
                  placeholder="john.doe@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground ml-1">Message</label>
                <textarea
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-cyan-500/50 focus:bg-black/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 dark:bg-white/5 dark:focus:bg-white/10 resize-none"
                  placeholder="How can we help you?"
                ></textarea>
              </div>

              <button
                type="submit"
                className="group relative flex w-full sm:w-auto items-center justify-center gap-2 overflow-hidden rounded-2xl bg-cyan-500 px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-cyan-400 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-background money-glow-emerald"
              >
                <span className="relative z-10">Send Message</span>
                <Send size={16} className="relative z-10 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;
