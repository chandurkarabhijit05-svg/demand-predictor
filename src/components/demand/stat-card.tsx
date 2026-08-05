import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "high" | "low" | "medium";
}) {
  const toneClass =
    tone === "high"
      ? "bg-high/15 text-high"
      : tone === "low"
        ? "bg-low/15 text-low"
        : tone === "medium"
          ? "bg-medium/15 text-medium"
          : "bg-brand/15 text-brand";

  return (
    <div className="glass rise-in rounded-3xl p-4 transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-3 text-2xl font-black tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
