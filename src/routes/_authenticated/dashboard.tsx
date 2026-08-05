import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowRight,
  Boxes,
  Package,
  TrendingDown,
  TrendingUp,
  Lightbulb,
} from "lucide-react";
import { useDemandData } from "@/hooks/use-demand-data";
import { buildForecasts, buildInsights } from "@/lib/forecast";
import { StatCard } from "@/components/demand/stat-card";
import { HistoryForecastChart, TopProductsChart, type DemandPoint } from "@/components/demand/charts";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Demand Dashboard — DemandIQ" },
      {
        name: "description",
        content:
          "Track total demand, trending products and forecast accuracy in one glassmorphism dashboard powered by AI demand prediction.",
      },
      { property: "og:title", content: "Demand Dashboard — DemandIQ" },
      {
        property: "og:description",
        content: "Total demand, trending products and restock signals at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useDemandData();
  const sales = data?.sales ?? [];

  const forecasts = useMemo(() => buildForecasts(sales, 14), [sales]);
  const insights = useMemo(() => buildInsights(forecasts), [forecasts]);

  const chartData = useMemo<DemandPoint[]>(() => {
    if (forecasts.length === 0) return [];
    const past = new Map<string, number>();
    const future = new Map<string, number>();
    for (const f of forecasts) {
      for (const p of f.history) past.set(p.date, (past.get(p.date) ?? 0) + p.quantity);
      for (const p of f.forecast) future.set(p.date, (future.get(p.date) ?? 0) + p.quantity);
    }
    const pastDates = [...past.keys()].sort().slice(-21);
    const points: DemandPoint[] = pastDates.map((d) => ({
      label: d.slice(5),
      sales: past.get(d) ?? 0,
      predicted: null,
    }));
    if (points.length > 0) points[points.length - 1].predicted = points[points.length - 1].sales;
    for (const d of [...future.keys()].sort()) {
      points.push({ label: d.slice(5), sales: null, predicted: future.get(d) ?? 0 });
    }
    return points;
  }, [forecasts]);

  const totalPredicted = forecasts.reduce((a, f) => a + f.totalPredicted, 0);
  const rising = forecasts.filter((f) => f.trend === "up").length;
  const falling = forecasts.filter((f) => f.trend === "down").length;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rise-in">
        <h1 className="text-2xl font-black sm:text-3xl">Demand overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Forecast for the next 14 days, generated from your uploaded sales history.
        </p>
      </header>

      {sales.length === 0 ? (
        <div className="glass rise-in rounded-3xl p-10 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-bold">No sales data yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a CSV with product_name, date and quantity to unlock forecasts and insights.
          </p>
          <Link
            to="/upload"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-transform hover:scale-[1.03]"
          >
            Upload data <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Boxes}
              label="Products tracked"
              value={String(forecasts.length)}
              hint={`${sales.length} sales rows`}
            />
            <StatCard
              icon={Package}
              label="Predicted demand"
              value={totalPredicted.toLocaleString()}
              hint="units over 14 days"
            />
            <StatCard
              icon={TrendingUp}
              label="Rising products"
              value={String(rising)}
              hint="demand trending up"
              tone="low"
            />
            <StatCard
              icon={TrendingDown}
              label="Cooling products"
              value={String(falling)}
              hint="demand trending down"
              tone="high"
            />
          </div>

          <section className="glass rise-in rounded-3xl p-4 sm:p-5">
            <h2 className="text-base font-bold">Past sales vs predicted demand</h2>
            <p className="text-xs text-muted-foreground">All products combined</p>
            <div className="mt-3">
              <HistoryForecastChart data={chartData} />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="glass rise-in rounded-3xl p-4 sm:p-5">
              <h2 className="text-base font-bold">Top products by predicted demand</h2>
              <div className="mt-3">
                <TopProductsChart
                  data={forecasts.slice(0, 6).map((f) => ({
                    product: f.product.length > 12 ? f.product.slice(0, 11) + "…" : f.product,
                    predicted: f.totalPredicted,
                    sold: Math.round(f.totalSold),
                  }))}
                />
              </div>
            </section>

            <section className="glass rise-in rounded-3xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <Lightbulb className="h-4 w-4 text-medium" /> Smart insights
                </h2>
                <Link to="/insights" className="text-xs font-semibold text-brand hover:underline">
                  View all
                </Link>
              </div>
              <ul className="mt-3 space-y-3">
                {insights.slice(0, 5).map((i) => (
                  <li key={i.id} className="rounded-2xl border border-border/60 bg-background/40 p-3">
                    <p className="text-sm font-semibold">{i.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
                  </li>
                ))}
                {insights.length === 0 && (
                  <li className="text-sm text-muted-foreground">No insights yet.</li>
                )}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
