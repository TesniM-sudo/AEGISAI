import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import CryptoChat from "./CryptoChat";

const PRIMARY = "hsl(var(--primary))";

export default function ChatLauncher() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[120] grid h-16 w-16 place-items-center rounded-2xl border border-black/10 bg-black/5 shadow-[0_16px_40px_-18px_rgba(34,211,238,0.45)] backdrop-blur-md transition hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/15 sm:bottom-5 sm:right-5 sm:h-20 sm:w-20"
        aria-label="Open chat"
      >
        <Bot size={40} className="text-cyan-100" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[130]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-background/70"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            />

            {isMobile ? (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="absolute bottom-0 left-0 right-0 flex h-[88vh] flex-col overflow-hidden rounded-t-3xl border-t border-black/10 bg-background/95 shadow-[0_-24px_80px_-30px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-white/15 dark:bg-background/85 dark:shadow-[0_-24px_80px_-30px_rgba(0,0,0,0.65)]"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                  <p id={titleId} className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                    AegisAI Chat
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-xl hover:bg-muted/30"
                    aria-label="Close"
                  >
                    <X size={16} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <CryptoChat assetName="AegisAI" color={PRIMARY} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="absolute bottom-4 right-4 flex h-[560px] w-[420px] flex-col overflow-hidden rounded-3xl border border-black/10 bg-background/95 shadow-[0_24px_90px_-35px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-white/15 dark:bg-background/85 dark:shadow-[0_24px_90px_-35px_rgba(0,0,0,0.75)]"
                initial={{ y: 18, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 18, opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                  <p id={titleId} className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                    AegisAI Chat
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-xl hover:bg-muted/30"
                    aria-label="Close"
                  >
                    <X size={16} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <CryptoChat assetName="AegisAI" color={PRIMARY} />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
