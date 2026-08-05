import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Bot, Loader2, Send } from "lucide-react";
import { askAssistant } from "@/lib/assistant.functions";
import { estimatedStock, type ProductForecast } from "@/lib/forecast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Which products should I restock first?",
  "Why is demand rising for my top product?",
  "What risks do you see in the next 7 days?",
];

export function AssistantPanel({ forecasts }: { forecasts: ProductForecast[] }) {
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const context = useMemo(
    () =>
      forecasts
        .slice(0, 20)
        .map(
          (f) =>
            `${f.product} (${f.category}): sold ${Math.round(f.totalSold)} units historically, avg ${f.avgPerDay.toFixed(1)}/day, predicted ${f.totalPredicted} units over next ${f.forecast.length} days, trend ${f.trend} (${Math.round(f.changePercent)}%), estimated stock ${estimatedStock(f)}`,
        )
        .join("\n"),
    [forecasts],
  );

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    const history = messages.slice(-8);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await ask({ data: { question: q, context, history } });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The assistant could not reply.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  return (
    <section className="glass rise-in flex flex-col rounded-3xl p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold">AI assistant</h2>
          <p className="truncate text-xs text-muted-foreground">
            Ask anything about your forecasts
          </p>
        </div>
      </div>

      <div className="mt-4 max-h-[26rem] min-h-40 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              I can explain the numbers behind your predictions. Try one of these:
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="block w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {m.content}
                </p>
              </div>
            ) : (
              <div
                key={i}
                className="md-body max-w-none text-foreground"
              >
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ),
          )
        )}
        {loading ? (
          <p className="animate-pulse text-sm text-muted-foreground">Thinking…</p>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask about a product, trend or restock plan…"
          maxLength={600}
          rows={2}
          className="min-h-11 resize-none rounded-2xl"
        />
        <Button
          onClick={() => void send(input)}
          disabled={loading || input.trim().length === 0}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
          aria-label="Send message"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </section>
  );
}
