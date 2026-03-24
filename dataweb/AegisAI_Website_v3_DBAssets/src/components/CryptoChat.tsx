import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-chat`
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
      ? `**${assetName} risk view**\n\nCurrent presentation mode suggests a measured risk profile based on recent momentum, broad stability, and confidence scoring. In the real AegisAI build, this panel can be replaced by your backend risk endpoint and chatbot reasoning layer.`
      : `**${assetName} looks manageable right now.** The idea here is to explain risk in easy words first, then show extra technical detail only when the user asks.`;
  }

  if (q.includes("why") || q.includes("explain")) {
    return expert
      ? `**Expert explanation**\n\nThis prototype is shaped for layered communication: concise portfolio narrative, confidence cue, and a deeper technical explanation on demand. That helps beginners stay comfortable while still serving advanced users.`
      : `**Simple explanation**\n\nThis screen is built to sound clear, not scary. It gives the main idea first, then leaves the heavy finance wording for users who ask for it.`;
  }

  if (q.includes("buy") || q.includes("best")) {
    return `I would present this as **decision support**, not a guaranteed buy signal. A good next step is adding your real scoring and prediction endpoints so the assistant can explain *why* one asset ranks above another.`;
  }

  return expert
    ? `**AegisAI prototype assistant**\n\nThis is a local demo response for ${assetName}. It shows how the website can switch between simple and expert language before you connect the real backend chatbot.`
    : `I'm in demo mode for **${assetName}**. The layout is ready for a chatbot that speaks simply by default and becomes more technical only when the user asks.`;
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

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    if (!CHAT_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      setTimeout(() => {
        upsertAssistant(buildLocalReply(assetName, text));
        setIsLoading(false);
      }, 400);
      return;
    }

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg], asset: assetName }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        upsertAssistant(err.error || "Something went wrong.");
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      upsertAssistant("Connection error. Please try again.");
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
          <Sparkles size={10} /> demo
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-8 text-center text-xs text-muted-foreground/50">
            <Bot size={24} className="mx-auto mb-2 opacity-30" />
            <p>Ask me about {assetName}</p>
            <p className="mt-1 text-[10px]">Simple by default · Expert detail on request · Backend-ready</p>
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
