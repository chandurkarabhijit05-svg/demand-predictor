import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Crown, Lightbulb, PackagePlus, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useDemandData } from "@/hooks/use-demand-data";
import { buildForecasts, buildInsights } from "@/lib/forecast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const ICONS = {
  trend: TrendingUp,
  stockout: AlertTriangle,
  bestseller: Crown,
  restock: PackagePlus,
  info: Lightbulb,
} as const;

const STORAGE_KEY = "demandiq:read-alerts";

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function NotificationBell() {
  const { data } = useDemandData();
  const sales = data?.sales ?? [];
  const [seen, setSeen] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => setSeen(readSeen()), []);

  const alerts = useMemo(() => {
    const forecasts = buildForecasts(sales, 14);
    return buildInsights(forecasts)
      .filter((i) => i.kind !== "info")
      .sort((a, b) =>
        a.severity === b.severity ? 0 : a.severity === "high" ? -1 : b.severity === "high" ? 1 : 0,
      )
      .slice(0, 12);
  }, [sales]);

  const unread = alerts.filter((a) => !seen.includes(a.id));

  function markAllRead() {
    const ids = alerts.map((a) => a.id);
    setSeen(ids);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ""}`}
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-high px-1 text-[10px] font-bold text-brand-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass w-80 rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-bold">Notifications</p>
          {unread.length > 0 ? (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No alerts yet. Upload sales data to start getting demand notifications.
            </p>
          ) : (
            alerts.map((a) => {
              const Icon = ICONS[a.kind];
              const isUnread = !seen.includes(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex gap-3 border-b border-border/40 px-4 py-3 last:border-0 ${
                    isUnread ? "bg-accent/30" : ""
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      a.severity === "high"
                        ? "text-high"
                        : a.severity === "medium"
                          ? "text-medium"
                          : "text-low"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="border-t border-border/60 p-3">
          <Button asChild variant="ghost" size="sm" className="w-full rounded-full text-xs">
            <Link to="/insights" onClick={() => setOpen(false)}>
              View all insights
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
