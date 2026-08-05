import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Schema = z.object({
  question: z.string().trim().min(1).max(600),
  context: z.string().max(6000).default(""),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You are DemandIQ's demand-planning assistant. Explain forecasts, trends, stockout risk and restock advice in plain, concise language for a shop owner. Use short markdown with bullets when helpful. Only use the forecast summary provided; if data is missing, say so.",
          },
          { role: "system", content: `Forecast summary:\n${data.context || "(no data yet)"}` },
          ...data.history,
          { role: "user", content: data.question },
        ],
      }),
    });

    if (res.status === 429) throw new Error("The assistant is rate limited. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted. Add credits to continue.");
    if (!res.ok) throw new Error(`Assistant request failed (${res.status})`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { reply: json.choices?.[0]?.message?.content?.trim() ?? "No answer returned." };
  });
