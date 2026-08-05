import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, LineChart as LineChartIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useDemandData } from "@/hooks/use-demand-data";
import {
  buildForecasts,
  downloadCsv,
  estimatedStock,
  forecastsToCsv,
  type ProductForecast,
} from "@/lib/forecast";
import { CompareChart, HistoryForecastChart, type DemandPoint } from "@/components/demand/charts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/predictions")({
  head: () => ({
    meta: [
      { title: "Demand Predictions — DemandIQ" },
      {
        name: "description",
        content:
          "Forecast 7 to 30 days of demand per product with a linear-regression model, compare products and export predictions as CSV.",
      },
      { property: "og:title", content: "Demand Predictions — DemandIQ" },
      {
        property: "og:description",
        content: "Per-product demand forecasts, product comparison and CSV export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PredictionsPage,
});

function TrendBadge({ f }: { f: ProductForecast }) {
  const Icon = f.trend === "up" ? TrendingUp : f.trend === "down" ? TrendingDown : Minus;
  const cls =
    f.trend === "up"
      ? "bg-low/15 text-low"
      : f.trend === "down"
        ? "bg-high/15 text-high"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {f.trend === "flat" ? "Stable" : `${Math.abs(Math.round(f.changePercent))}%`}
    </span>
  );
}

function PredictionsPage() {
  const { data, isLoading } = useDemandData();
  const sales = data?.sales ?? [];

  const [horizon, setHorizon] = useState(14);
  const [buffer, setBuffer] = useState(20);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [compare, setCompare] = useState<string[]>([]);

  const filteredSales = useMemo(
    () =>
      sales.filter((s) => (!from || s.date >= from) && (!to || s.date <= to)),
    [sales, from, to],
  );

  const forecasts = useMemo(() => buildForecasts(filteredSales, horizon), [filteredSales, horizon]);

  useEffect(() => {
    if (forecasts.length === 0) return;
    if (!forecasts.some((f) => f.product === selected)) setSelected(forecasts[0].product);
  }, [forecasts, selected]);

  const active = forecasts.find((f) => f.product === selected);

  const chartData = useMemo<DemandPoint[]>(() => {
    if (!active) return [];
    const points: DemandPoint[] = active.history.slice(-30).map((p) => ({
      label: p.date.slice(5),
      sales: p.quantity,
      predicted: null,
    }));
    if (points.length > 0) points[points.length - 1].predicted = points[points.length - 1].sales;
    for (const p of active.forecast) {
      points.push({ label: p.date.slice(5), sales: null, predicted: p.quantity });
    }
    return points;
  }, [active]);

  const compareData = useMemo(() => {
    if (compare.length === 0) return [];
    const dates = new Set<string>();
    const map = new Map<string, Record<string, number>>();
    for (const name of compare) {
      const f = forecasts.find((x) => x.product === name);
      if (!f) continue;
      for (const p of f.forecast) {
        dates.add(p.date);
        const row = map.get(p.date) ?? {};
        row[name] = p.quantity;
        map.set(p.date, row);
      }
    }
    return [...dates]
      .sort()
      .map((d) => ({ label: d.slice(5), ...(map.get(d) ?? {}) }) as Record<string, string | number | null>);
  }, [compare, forecasts]);

  function toggleCompare(name: string) {
    setCompare((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : prev.length >= 5 ? prev : [...prev, name],
    );
  }

  function exportCsv() {
    if (forecasts.length === 0) return;
    downloadCsv(`demandiq-forecast-${horizon}d.csv`, forecastsToCsv(forecasts, buffer));
    toast.success("Forecast CSV downloaded.");
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="glass mx-auto max-w-xl rounded-3xl p-10 text-center">
        <LineChartIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-bold">Nothing to forecast yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload a sales CSV to build predictions.</p>
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
      <header className="rise-in flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black sm:text-3xl">Predictions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Linear-regression forecast per product over your chosen horizon.
          </p>
        </div>
        <Button onClick={exportCsv} variant="secondary" className="rounded-full">
          <Download className="mr-2 h-4 w-4" /> Download CSV
        </Button>
      </header>

      <section className="glass rise-in grid gap-5 rounded-3xl p-5 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Forecast horizon</span>
            <span className="tabular-nums text-brand">{horizon} days</span>
          </div>
          <Slider
            className="mt-3"
            min={7}
            max={30}
            step={1}
            value={[horizon]}
            onValueChange={(v) => setHorizon(v[0] ?? 14)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Safety buffer</span>
            <span className="tabular-nums text-brand">{buffer}%</span>
          </div>
          <Slider
            className="mt-3"
            min={0}
            max={60}
            step={5}
            value={[buffer]}
            onValueChange={(v) => setBuffer(v[0] ?? 20)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1.5" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1.5" />
          </label>
        </div>
      </section>

      <section className="glass rise-in rounded-3xl p-4 sm:p-5">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {forecasts.map((f) => (
            <button
              key={f.product}
              onClick={() => setSelected(f.product)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                selected === f.product
                  ? "bg-brand text-brand-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {f.product}
            </button>
          ))}
        </div>

        {active ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold">{active.product}</h2>
              <TrendBadge f={active} />
              <span className="text-xs text-muted-foreground">
                {active.totalPredicted} units predicted · {Math.round(active.avgPerDay)} units/day
                historic average
              </span>
            </div>
            <div className="mt-3">
              <HistoryForecastChart data={chartData} />
            </div>
          </>
        ) : null}
      </section>

      <section className="glass rise-in rounded-3xl p-4 sm:p-5">
        <h2 className="text-base font-bold">Compare products</h2>
        <p className="text-xs text-muted-foreground">Pick up to 5 products to overlay forecasts.</p>
        <div className="no-scrollbar mt-3 flex flex-wrap gap-2">
          {forecasts.slice(0, 14).map((f) => (
            <button
              key={f.product}
              onClick={() => toggleCompare(f.product)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                compare.includes(f.product)
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-border/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {f.product}
            </button>
          ))}
        </div>
        {compare.length > 0 ? (
          <div className="mt-4">
            <CompareChart data={compareData} products={compare} />
          </div>
        ) : (
          <p className="mt-6 pb-4 text-center text-sm text-muted-foreground">
            Select products above to compare their forecasts.
          </p>
        )}
      </section>

      <section className="glass rise-in overflow-hidden rounded-3xl">
        <div className="border-b border-border/60 p-4">
          <h2 className="text-base font-bold">Forecast table</h2>
          <p className="text-xs text-muted-foreground">
            Recommended stock = predicted demand + {buffer}% buffer
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Trend</th>
                <th className="px-4 py-3 text-right">Predicted</th>
                <th className="px-4 py-3 text-right">Est. stock</th>
                <th className="px-4 py-3 text-right">Recommended</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => {
                const stock = estimatedStock(f);
                const recommended = Math.round(f.totalPredicted * (1 + buffer / 100));
                return (
                  <tr key={f.product} className="border-t border-border/50">
                    <td className="px-4 py-2.5 font-medium">{f.product}</td>
                    <td className="px-4 py-2.5">
                      <TrendBadge f={f} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.totalPredicted}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {stock}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                        recommended > stock ? "text-high" : ""
                      }`}
                    >
                      {recommended}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
