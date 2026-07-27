import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generatePredictions } from "@/lib/predictions.functions";
import { CATEGORIES, parseSalesCsv, trendLabel, type PredictionRow } from "@/lib/demand";
import { ProductCard } from "@/components/demand/product-card";
import { DemandChart, type ChartPoint } from "@/components/demand/demand-chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BellRing,
  CloudUpload,
  Loader2,
  LogOut,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Demand Dashboard — DemandIQ" },
      {
        name: "description",
        content:
          "See trending products, AI demand forecasts, restock recommendations and high-demand alerts for your store.",
      },
      { property: "og:title", content: "Demand Dashboard — DemandIQ" },
      {
        property: "og:description",
        content: "AI demand forecasts and inventory recommendations for your store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const FILTERS = ["All", "High Demand", "Low Stock", "Trending"] as const;
type Filter = (typeof FILTERS)[number];

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const runPredictions = useServerFn(generatePredictions);
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [filter, setFilter] = useState<Filter>("All");
  const [uploading, setUploading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["demand"],
    queryFn: async () => {
      const [profileRes, salesRes, predRes] = await Promise.all([
        supabase.from("profiles").select("store_name").maybeSingle(),
        supabase
          .from("sales_data")
          .select("product_name, category, date, quantity")
          .order("date", { ascending: true })
          .limit(2000),
        supabase.from("predictions").select("*").order("predicted_quantity", { ascending: false }),
      ]);
      if (salesRes.error) throw salesRes.error;
      if (predRes.error) throw predRes.error;
      return {
        storeName: profileRes.data?.store_name ?? "My Store",
        sales: salesRes.data ?? [],
        predictions: (predRes.data ?? []) as PredictionRow[],
      };
    },
  });

  useEffect(() => {
    if (error) toast.error("Could not load your dashboard data.");
  }, [error]);

  const salesByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of data?.sales ?? [])
      map.set(s.product_name, (map.get(s.product_name) ?? 0) + s.quantity);
    return map;
  }, [data]);

  const chartData = useMemo<ChartPoint[]>(() => {
    const sales = data?.sales ?? [];
    if (sales.length === 0) return [];
    const byDate = new Map<string, number>();
    for (const s of sales) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.quantity);
    const dates = [...byDate.keys()].sort().slice(-14);
    const points: ChartPoint[] = dates.map((d) => ({
      label: d.slice(5),
      sales: byDate.get(d) ?? 0,
      predicted: null,
    }));
    const preds = data?.predictions ?? [];
    if (preds.length > 0 && points.length > 0) {
      const horizon = preds[0].horizon_days || 7;
      const totalPredicted = preds.reduce((a, p) => a + p.predicted_quantity, 0);
      const perDay = Math.round(totalPredicted / horizon);
      points[points.length - 1].predicted = points[points.length - 1].sales;
      const lastDate = new Date(dates[dates.length - 1]);
      for (let i = 1; i <= Math.min(horizon, 10); i++) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i);
        points.push({ label: d.toISOString().slice(5, 10), sales: 0, predicted: perDay });
      }
    }
    return points;
  }, [data]);

  const visible = useMemo(() => {
    let list = data?.predictions ?? [];
    if (category !== "All") list = list.filter((p) => p.category === category);
    if (search.trim())
      list = list.filter((p) =>
        p.product_name.toLowerCase().includes(search.trim().toLowerCase()),
      );
    if (filter === "High Demand") list = list.filter((p) => trendLabel(p.trend) === "high");
    if (filter === "Low Stock")
      list = list.filter((p) => p.predicted_quantity > p.current_stock);
    if (filter === "Trending")
      list = [...list].sort((a, b) => b.predicted_quantity - a.predicted_quantity).slice(0, 6);
    return list;
  }, [data, category, search, filter]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const rows = parseSalesCsv(await file.text());
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Session expired. Please sign in again.");
      const { error: insertError } = await supabase
        .from("sales_data")
        .insert(rows.map((r) => ({ ...r, user_id: userId })));
      if (insertError) throw insertError;
      toast.success(`${rows.length} sales rows uploaded.`);
      await queryClient.invalidateQueries({ queryKey: ["demand"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePredict() {
    setPredicting(true);
    try {
      const result = await runPredictions({ data: { horizonDays: 7, bufferPercent: 20 } });
      setAlerts(result.alerts);
      toast.success(`AI forecast ready for ${result.count} products.`);
      await queryClient.invalidateQueries({ queryKey: ["demand"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Prediction failed.");
    } finally {
      setPredicting(false);
    }
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="header-gradient rounded-b-[2rem] px-5 pb-12 pt-8 text-header-foreground">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-header-foreground/60">
                <MapPin className="h-3 w-3 shrink-0" /> Store
              </p>
              <h1 className="truncate text-2xl font-black">
                {isLoading ? "Loading…" : data?.storeName}
              </h1>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-header-foreground/10 transition-colors hover:bg-header-foreground/20"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-full bg-header-foreground/10 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-header-foreground/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              maxLength={80}
              className="w-full bg-transparent text-sm outline-none placeholder:text-header-foreground/50"
            />
          </div>

          <div className="mt-5 flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              variant="secondary"
              className="flex-1 rounded-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="mr-2 h-4 w-4" />
              )}
              Upload CSV
            </Button>
            <Button
              className="flex-1 rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={handlePredict}
              disabled={predicting}
            >
              {predicting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Run AI forecast
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="-mt-6" aria-label="Categories">
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.name}
                onClick={() => setCategory(c.name)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-card transition-all ${
                  category === c.name
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-card text-card-foreground hover:-translate-y-0.5"
                }`}
              >
                <span aria-hidden>{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 flex flex-wrap gap-2" aria-label="Filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground hover:bg-accent"
              }`}
            >
              {f}
            </button>
          ))}
        </section>

        {alerts.length > 0 && (
          <section className="mt-5 rounded-3xl border border-high/30 bg-high/8 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-high">
              <BellRing className="h-4 w-4" /> Demand alerts
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {alerts.slice(0, 6).map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-border bg-card p-4 shadow-card">
          <h2 className="text-base font-bold text-card-foreground">
            Past sales vs predicted demand
          </h2>
          {isLoading ? (
            <Skeleton className="mt-4 h-56 w-full rounded-2xl" />
          ) : chartData.length === 0 ? (
            <p className="mt-6 pb-6 text-center text-sm text-muted-foreground">
              Upload a sales CSV to see your trend line.
            </p>
          ) : (
            <div className="mt-3">
              <DemandChart data={chartData} />
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-black text-foreground">Trending products</h2>
          <p className="text-sm text-muted-foreground">
            AI forecast with recommended restock levels
          </p>

          {isLoading ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-52 rounded-3xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {(data?.predictions.length ?? 0) === 0
                  ? "No predictions yet. Upload your sales CSV (product_name, date, quantity) and run the AI forecast."
                  : "No products match these filters."}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {visible.map((p) => (
                <ProductCard
                  key={p.id}
                  prediction={p}
                  currentSales={salesByProduct.get(p.product_name) ?? 0}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
