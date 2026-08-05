import type { SaleRow } from "./demand";

export interface SeriesPoint {
  date: string;
  quantity: number;
}

export interface ProductForecast {
  product: string;
  category: string;
  history: SeriesPoint[];
  forecast: SeriesPoint[];
  slope: number;
  avgPerDay: number;
  totalPredicted: number;
  totalSold: number;
  trend: "up" | "down" | "flat";
  changePercent: number;
}

function toDayNumber(date: string) {
  return Math.floor(Date.parse(date) / 86_400_000);
}

function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Ordinary least squares on (dayNumber, quantity). */
export function linearRegression(points: SeriesPoint[]) {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const xs = points.map((p) => toDayNumber(p.date));
  const base = xs[0];
  const x = xs.map((v) => v - base);
  const y = points.map((p) => p.quantity);
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    den += (x[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX, base };
}

/** Groups rows by product, fills missing days with 0, and forecasts with linear regression. */
export function buildForecasts(rows: SaleRow[], horizonDays: number): ProductForecast[] {
  const byProduct = new Map<string, { category: string; byDate: Map<string, number> }>();
  for (const r of rows) {
    if (!r.product_name || !r.date) continue;
    const entry = byProduct.get(r.product_name) ?? {
      category: r.category || "General",
      byDate: new Map<string, number>(),
    };
    const qty = Number.isFinite(r.quantity) ? r.quantity : 0;
    entry.byDate.set(r.date, (entry.byDate.get(r.date) ?? 0) + qty);
    byProduct.set(r.product_name, entry);
  }

  const results: ProductForecast[] = [];
  for (const [product, { category, byDate }] of byProduct) {
    const dates = [...byDate.keys()].sort();
    if (dates.length === 0) continue;

    // fill gaps with 0 so the trend reflects real calendar days
    const history: SeriesPoint[] = [];
    let cursor = dates[0];
    const last = dates[dates.length - 1];
    let guard = 0;
    while (cursor <= last && guard < 400) {
      history.push({ date: cursor, quantity: byDate.get(cursor) ?? 0 });
      cursor = addDays(cursor, 1);
      guard++;
    }

    const { slope, intercept } = linearRegression(history);
    const n = history.length;
    const forecast: SeriesPoint[] = [];
    for (let i = 1; i <= horizonDays; i++) {
      const value = intercept + slope * (n - 1 + i);
      forecast.push({ date: addDays(last, i), quantity: Math.max(0, Math.round(value)) });
    }

    const totalSold = history.reduce((a, p) => a + p.quantity, 0);
    const avgPerDay = totalSold / n;
    const totalPredicted = forecast.reduce((a, p) => a + p.quantity, 0);
    const predAvg = totalPredicted / Math.max(horizonDays, 1);
    const changePercent = avgPerDay === 0 ? 0 : ((predAvg - avgPerDay) / avgPerDay) * 100;

    results.push({
      product,
      category,
      history,
      forecast,
      slope,
      avgPerDay,
      totalPredicted,
      totalSold,
      trend: changePercent > 5 ? "up" : changePercent < -5 ? "down" : "flat",
      changePercent,
    });
  }

  return results.sort((a, b) => b.totalPredicted - a.totalPredicted);
}

export interface Insight {
  id: string;
  kind: "trend" | "stockout" | "bestseller" | "restock" | "info";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

export function buildInsights(forecasts: ProductForecast[], bufferPercent = 20): Insight[] {
  const insights: Insight[] = [];
  if (forecasts.length === 0) return insights;

  const best = forecasts[0];
  insights.push({
    id: "bestseller",
    kind: "bestseller",
    title: `${best.product} is your best-selling product`,
    detail: `${Math.round(best.totalSold)} units sold historically and ${best.totalPredicted} more expected over the forecast window.`,
    severity: "low",
  });

  for (const f of forecasts.slice(0, 12)) {
    if (f.trend === "up") {
      insights.push({
        id: `trend-up-${f.product}`,
        kind: "trend",
        title: `Demand is increasing for ${f.product}`,
        detail: `Projected daily demand is up ${Math.abs(Math.round(f.changePercent))}% versus its historical average.`,
        severity: "medium",
      });
    } else if (f.trend === "down") {
      insights.push({
        id: `trend-down-${f.product}`,
        kind: "trend",
        title: `Demand is cooling for ${f.product}`,
        detail: `Projected daily demand is down ${Math.abs(Math.round(f.changePercent))}%. Consider trimming your next order.`,
        severity: "low",
      });
    }

    const stock = estimatedStock(f);
    const perDay = f.totalPredicted / Math.max(f.forecast.length, 1);
    if (perDay > 0) {
      const daysLeft = Math.floor(stock / perDay);
      if (daysLeft <= 7) {
        insights.push({
          id: `stockout-${f.product}`,
          kind: "stockout",
          title: `${f.product} stock may run out in ${Math.max(daysLeft, 0)} days`,
          detail: `Estimated on-hand ${stock} units against ${Math.round(perDay)} units/day of predicted demand.`,
          severity: daysLeft <= 3 ? "high" : "medium",
        });
      }
    }

    const recommended = Math.round(f.totalPredicted * (1 + bufferPercent / 100));
    if (recommended > stock) {
      insights.push({
        id: `restock-${f.product}`,
        kind: "restock",
        title: `Restock ${f.product}: order ${recommended - stock} units`,
        detail: `Recommended cover is ${recommended} units (forecast + ${bufferPercent}% buffer) versus ${stock} estimated on hand.`,
        severity: "high",
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  return insights.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 24);
}

/** Proxy for on-hand stock: ~70% of a horizon's worth of average sales. */
export function estimatedStock(f: ProductForecast) {
  return Math.round(f.avgPerDay * Math.max(f.forecast.length, 1) * 0.7);
}

export function forecastsToCsv(forecasts: ProductForecast[], bufferPercent = 20) {
  const header =
    "product_name,category,date,predicted_quantity,trend,estimated_stock,recommended_stock";
  const lines = [header];
  for (const f of forecasts) {
    const stock = estimatedStock(f);
    const recommended = Math.round(f.totalPredicted * (1 + bufferPercent / 100));
    for (const p of f.forecast) {
      lines.push(
        [f.product, f.category, p.date, p.quantity, f.trend, stock, recommended].join(","),
      );
    }
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
