import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  horizonDays: z.number().int().min(7).max(30).default(7),
  bufferPercent: z.number().int().min(0).max(100).default(20),
});

type AiPrediction = {
  product_name: string;
  predicted_demand: number;
  demand_trend: "high" | "medium" | "low";
};

function fallbackPredictions(
  rows: { product_name: string; quantity: number; date: string }[],
  horizonDays: number,
): AiPrediction[] {
  const byProduct = new Map<string, { total: number; days: Set<string> }>();
  for (const r of rows) {
    const entry = byProduct.get(r.product_name) ?? { total: 0, days: new Set<string>() };
    entry.total += r.quantity;
    entry.days.add(r.date);
    byProduct.set(r.product_name, entry);
  }
  return [...byProduct.entries()].map(([product_name, e]) => {
    const perDay = e.total / Math.max(e.days.size, 1);
    const predicted = Math.round(perDay * horizonDays);
    return {
      product_name,
      predicted_demand: predicted,
      demand_trend: perDay > 20 ? "high" : perDay > 8 ? "medium" : "low",
    } as AiPrediction;
  });
}

export const generatePredictions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sales, error } = await supabase
      .from("sales_data")
      .select("product_name, category, date, quantity")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .limit(2000);

    if (error) throw new Error(error.message);
    if (!sales || sales.length === 0) {
      throw new Error("No sales data found. Upload a CSV first.");
    }

    const categoryOf = new Map<string, string>();
    for (const s of sales) categoryOf.set(s.product_name, s.category ?? "General");

    let predictions: AiPrediction[] = [];
    const apiKey = process.env.LOVABLE_API_KEY;

    if (apiKey) {
      const compact = sales
        .map((s) => `${s.product_name}|${s.date}|${s.quantity}`)
        .slice(-800)
        .join("\n");

      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
          },
          body: JSON.stringify({
            model: "google/gemini-3.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You are a demand forecasting engine. Reply with JSON only, no prose, no markdown fences.",
              },
              {
                role: "user",
                content: `Analyze the following sales data and predict future demand for each product over the next ${data.horizonDays} days. Identify trends and return JSON with the shape {"predictions":[{"product_name":string,"predicted_demand":number,"demand_trend":"high"|"medium"|"low"}]}. Data (product|date|quantity):\n${compact}`,
              },
            ],
          }),
        });

        if (res.status === 429) throw new Error("rate_limited");
        if (res.status === 402) throw new Error("credits_exhausted");
        if (!res.ok) throw new Error(`AI request failed (${res.status})`);

        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = json.choices?.[0]?.message?.content ?? "";
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as { predictions?: AiPrediction[] } | AiPrediction[];
        const list = Array.isArray(parsed) ? parsed : (parsed.predictions ?? []);
        predictions = list
          .filter((p) => p && typeof p.product_name === "string")
          .map((p) => ({
            product_name: p.product_name,
            predicted_demand: Math.max(0, Math.round(Number(p.predicted_demand) || 0)),
            demand_trend: (["high", "medium", "low"] as const).includes(p.demand_trend)
              ? p.demand_trend
              : "medium",
          }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        if (message === "rate_limited")
          throw new Error("AI is rate limited right now. Please try again in a moment.");
        if (message === "credits_exhausted")
          throw new Error("AI credits are exhausted. Add credits to keep forecasting.");
        console.error("AI prediction failed, using statistical fallback:", message);
      }
    }

    if (predictions.length === 0) {
      predictions = fallbackPredictions(sales, data.horizonDays);
    }

    // current stock proxy: recent average daily sales across the horizon
    const soldByProduct = new Map<string, { total: number; days: Set<string> }>();
    for (const s of sales) {
      const e = soldByProduct.get(s.product_name) ?? { total: 0, days: new Set<string>() };
      e.total += s.quantity;
      e.days.add(s.date);
      soldByProduct.set(s.product_name, e);
    }

    const rows = predictions.map((p) => {
      const stats = soldByProduct.get(p.product_name);
      const perDay = stats ? stats.total / Math.max(stats.days.size, 1) : 0;
      const currentStock = Math.round(perDay * data.horizonDays * 0.7);
      return {
        user_id: userId,
        product_name: p.product_name,
        category: categoryOf.get(p.product_name) ?? "General",
        predicted_quantity: p.predicted_demand,
        trend: p.demand_trend,
        current_stock: currentStock,
        recommended_stock: Math.round(p.predicted_demand * (1 + data.bufferPercent / 100)),
        horizon_days: data.horizonDays,
      };
    });

    await supabase.from("predictions").delete().eq("user_id", userId);
    const { error: insertError } = await supabase.from("predictions").insert(rows);
    if (insertError) throw new Error(insertError.message);

    const alerts = rows
      .filter((r) => r.predicted_quantity > r.current_stock)
      .map((r) => `High demand expected for ${r.product_name}`);

    return { count: rows.length, alerts };
  });
