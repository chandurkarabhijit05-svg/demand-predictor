import { trendLabel, type PredictionRow } from "@/lib/demand";
import { TrendingDown, TrendingUp, Minus, Package } from "lucide-react";

const trendStyles = {
  high: { bg: "bg-high/12 text-high", label: "High demand", Icon: TrendingUp },
  medium: { bg: "bg-medium/15 text-medium", label: "Medium", Icon: Minus },
  low: { bg: "bg-low/12 text-low", label: "Low", Icon: TrendingDown },
} as const;

export function ProductCard({
  prediction,
  currentSales,
}: {
  prediction: PredictionRow;
  currentSales: number;
}) {
  const trend = trendLabel(prediction.trend);
  const style = trendStyles[trend];
  const short = prediction.product_name.slice(0, 2).toUpperCase();
  const understocked = prediction.predicted_quantity > prediction.current_stock;

  return (
    <article className="group rounded-3xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-float">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-black text-accent-foreground">
          {short}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-card-foreground">
            {prediction.product_name}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{prediction.category}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.bg}`}
        >
          <style.Icon className="h-3 w-3" />
          {style.label}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-surface px-2 py-3">
          <dt className="text-[11px] text-muted-foreground">Current sales</dt>
          <dd className="text-lg font-bold text-card-foreground">{currentSales}</dd>
        </div>
        <div className="rounded-2xl bg-surface px-2 py-3">
          <dt className="text-[11px] text-muted-foreground">Predicted</dt>
          <dd className="text-lg font-bold text-brand">{prediction.predicted_quantity}</dd>
        </div>
        <div className="rounded-2xl bg-surface px-2 py-3">
          <dt className="text-[11px] text-muted-foreground">In stock</dt>
          <dd className="text-lg font-bold text-card-foreground">{prediction.current_stock}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-primary/5 px-3 py-2.5 text-xs">
        <Package className="h-4 w-4 shrink-0 text-brand" />
        <span className="min-w-0 text-muted-foreground">
          Restock to{" "}
          <strong className="font-semibold text-card-foreground">
            {prediction.recommended_stock} units
          </strong>{" "}
          for the next {prediction.horizon_days} days
        </span>
      </div>

      {understocked && (
        <p className="mt-2 rounded-2xl bg-high/10 px-3 py-2 text-xs font-medium text-high">
          Alert: predicted demand exceeds stock on hand.
        </p>
      )}
    </article>
  );
}
