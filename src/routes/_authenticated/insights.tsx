import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, Crown, Lightbulb, PackagePlus, TrendingUp } from "lucide-react";
import { useDemandData } from "@/hooks/use-demand-data";
import { buildForecasts, buildInsights, estimatedStock } from "@/lib/forecast";
import { AssistantPanel } from "@/components/demand/assistant-panel";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights & Recommendations — DemandIQ" },
      {
        name: "description",
        content:
          "Smart demand insights, stockout warnings, restock recommendations and an AI assistant that explains every prediction.",
      },
      { property: "og:title", content: "Insights & Recommendations — DemandIQ" },
      {
        property: "og:description",
        content: "Restock alerts, best-sellers and an AI assistant for your demand forecasts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsightsPage,
});

const ICONS = {
  trend: TrendingUp,
  stockout: AlertTriangle,
  bestseller: Crown,
  restock: PackagePlus,
  info: Lightbulb,
} as const;

function InsightsPage() {
  const { data, isLoading } = useDemandData();
  const sales = data?.sales ?? [];

  const forecasts = useMemo(() => buildForecasts(sales, 14), [sales]);
  const insights = useMemo(() => buildInsights(forecasts), [forecasts]);
  const restock = insights.filter((i) => i.kind === "restock" || i.kind === "stockout");
  const best = forecasts[0];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-24 rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="glass mx-auto max-w-xl rounded-3xl p-10 text-center">
        <Lightbulb className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-bold">No insights yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload sales data and DemandIQ will surface trends, stockout risks and restock advice.
        </p>
        <Link
          to="/upload"
          className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
        >
          Upload data
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rise-in">
        <h1 className="text-2xl font-black sm:text-3xl">Insights & recommendations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatically generated from your 14-day forecast.
        </p>
      </header>

      {best ? (
        <section className="glass rise-in flex flex-wrap items-center gap-4 rounded-3xl p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-medium/15 text-medium">
            <Crown className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Best-selling product
            </p>
            <p className="truncate text-lg font-black">{best.product}</p>
          </div>
          <div className="ml-auto flex gap-6 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Sold</p>
              <p className="text-lg font-bold tabular-nums">{Math.round(best.totalSold)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Predicted</p>
              <p className="text-lg font-bold tabular-nums text-brand">{best.totalPredicted}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Est. stock</p>
              <p className="text-lg font-bold tabular-nums">{estimatedStock(best)}</p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass rise-in rounded-3xl p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Lightbulb className="h-4 w-4 text-medium" /> Smart insights
          </h2>
          <ul className="mt-3 space-y-3">
            {insights.map((i) => {
              const Icon = ICONS[i.kind];
              const tone =
                i.severity === "high"
                  ? "bg-high/15 text-high"
                  : i.severity === "medium"
                    ? "bg-medium/15 text-medium"
                    : "bg-low/15 text-low";
              return (
                <li
                  key={i.id}
                  className="flex gap-3 rounded-2xl border border-border/60 bg-background/40 p-3 transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{i.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
                  </div>
                </li>
              );
            })}
            {insights.length === 0 ? (
              <li className="text-sm text-muted-foreground">Nothing notable right now.</li>
            ) : null}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="glass rise-in rounded-3xl p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <PackagePlus className="h-4 w-4 text-high" /> Restock alerts
            </h2>
            <ul className="mt-3 space-y-2">
              {restock.slice(0, 8).map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-high/25 bg-high/10 px-3 py-2 text-sm"
                >
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
                </li>
              ))}
              {restock.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  Stock levels look healthy across your catalogue.
                </li>
              ) : null}
            </ul>
          </section>

          <AssistantPanel forecasts={forecasts} />
        </div>
      </div>
    </div>
  );
}
