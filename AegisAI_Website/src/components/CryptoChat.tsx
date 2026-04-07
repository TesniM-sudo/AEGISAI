import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/chat`
  : "";

interface CryptoChatProps {
  assetName: string;
  color: string;
}

const buildLocalReply = (assetName: string, text: string) => {
  const q = text.toLowerCase();
  const expert = q.includes("expert") || q.includes("technical");

  if (q.includes("risk")) {
    return expert
      ? `**${assetName} risk view**\n\nCurrent presentation mode suggests a measured risk profile based on recent momentum, broad stability, and confidence scoring.`
      : `**${assetName} looks manageable right now.** Risk is explained in simple terms first, then technical detail on request.`;
  }

  if (q.includes("why") || q.includes("explain")) {
    return expert
      ? `**Expert explanation**\n\nThis prototype is shaped for layered communication: concise portfolio narrative, confidence cue, and a deeper technical explanation on demand.`
      : `**Simple explanation**\n\nThis screen is built to sound clear, not scary. It gives the main idea first.`;
  }

  if (q.includes("buy") || q.includes("best")) {
    return `I would present this as **decision support**, not a guaranteed buy signal.`;
  }

  return expert
    ? `**AegisAI prototype assistant**\n\nThis is a local demo response for ${assetName}.`
    : `I'm in demo mode for **${assetName}**. The layout is ready for a chatbot that speaks simply by default.`;
};

const CryptoChat = ({ assetName, color }: CryptoChatProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    if (!CHAT_URL) {
      setTimeout(() => {
        const reply = buildLocalReply(assetName, text);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        setIsLoading(false);
      }, 400);
      return;
    }

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: "Request failed" }));
        setMessages((prev) => [...prev, { role: "assistant", content: err.detail || "Something went wrong." }]);
        setIsLoading(false);
        return;
      }

      const data = await resp.json();
      const reply = data.reply || "No response from assistant.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    }

    setIsLoading(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bot size={16} style={{ color }} />
          <span className="truncate text-xs font-semibold uppercase tracking-widest text-muted-foreground">{assetName} Copilot</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-cyan-300">
          <Sparkles size={10} /> live
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-8 text-center text-xs text-muted-foreground/50">
            <Bot size={24} className="mx-auto mb-2 opacity-30" />
            <p>Ask me about {assetName}</p>
            <p className="mt-1 text-[10px]">Powered by AegisAI Â· Simple by default Â· Expert detail on request</p>
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
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.role === "user" ? "bg-muted text-foreground" : "glass-card"}`}>
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
            <div className="glass-card rounded-2xl px-3 py-2">
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
        <div className="glass-card flex items-center gap-2 rounded-xl px-3 py-2">
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
