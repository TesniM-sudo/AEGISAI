import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
type SessionData = { email: string; role: "admin" | "user" };

const API_BASE = import.meta.env.VITE_MARKET_API_URL || "http://127.0.0.1:8010";
const CHAT_URL = `${API_BASE}/chat`;
const SESSION_KEY = "aegis_account_session_v2";

interface CryptoChatProps {
  assetName: string;
  color: string;
}

type ChatResponse = {
  reply?: string;
  intent?: string;
  symbols?: string[];
  structured_data?: Record<string, unknown>;
};

const loadSession = (): SessionData | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.email || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
};

const buildLocalReply = (assetName: string, text: string) => {
  const q = text.toLowerCase();

  if (q.includes("risk")) {
    return `**${assetName} risk view**\n\nAsk about a symbol like AAPL or BTC-USD to get the latest risk from the backend dataset.`;
  }

  if (q.includes("why") || q.includes("explain")) {
    return `**Simple explanation**\n\nAsk me to explain a finance term like volatility, or ask for the latest risk on a tracked asset.`;
  }

  if (q.includes("buy") || q.includes("best")) {
    return `Use the trade and dashboard pages for market context, then ask the chatbot for a quick explanation of risk or trend.`;
  }

  return `Ask about tracked assets like **AAPL**, **TSLA**, **BTC-USD**, **ETH-USD**, or **EURUSD=X**.`;
};

const CryptoChat = ({ assetName, color }: CryptoChatProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const session = loadSession();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const enrichedMessage = assetName && assetName !== "AegisAI" ? `${text} about ${assetName}` : text;
    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // UPDATED: send user_id so the backend can use account context.
        body: JSON.stringify({
          message: enrichedMessage,
          user_id: session?.email ?? null,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Chat request failed with status ${resp.status}`);
      }

      const data = (await resp.json()) as ChatResponse;
      const reply = data.reply?.trim() || buildLocalReply(assetName, text);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (error) {
      console.error("Chat API unavailable, using local fallback:", error);
      const reply = buildLocalReply(assetName, text);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bot size={16} style={{ color }} />
          <span className="truncate text-xs font-semibold uppercase tracking-widest text-muted-foreground">{assetName} Copilot</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-black/10 bg-black/5 px-2 py-1 text-[10px] text-cyan-500 dark:border-white/10 dark:bg-white/5 dark:text-cyan-300">
          <Sparkles size={10} /> backend
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-8 text-center text-xs text-muted-foreground/50">
            <Bot size={24} className="mx-auto mb-2 opacity-30" />
            <p>Ask me about {assetName}</p>
            <p className="mt-1 text-[10px]">Connected to AegisAI backend chat when available</p>
            {session?.email && <p className="mt-1 text-[10px]">Signed in context enabled for {session.email}</p>}
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: `${color}22` }}>
                  <Bot size={10} style={{ color }} />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.role === "user" ? "bg-muted text-foreground" : "bg-white border border-black/10 shadow-sm dark:bg-black/20 dark:border-white/10 dark:shadow-none"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-xs max-w-none [&_p]:m-0 [&_p]:text-xs [&_strong]:text-foreground">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User size={10} className="text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2">
            <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: `${color}22` }}>
              <Bot size={10} style={{ color }} />
            </div>
            <div className="rounded-2xl px-3 py-2 bg-white border border-black/10 shadow-sm dark:bg-black/20 dark:border-white/10 dark:shadow-none">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/40" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/40" style={{ animationDelay: "0.15s" }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/40" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/30 p-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white border border-black/10 shadow-sm dark:bg-black/20 dark:border-white/10 dark:shadow-none">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`Ask about ${assetName}...`}
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
            disabled={isLoading}
          />
          <button onClick={send} disabled={isLoading || !input.trim()} className="rounded-lg p-1.5 transition-colors hover:bg-muted/50 disabled:opacity-30">
            <Send size={12} style={{ color }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CryptoChat;
