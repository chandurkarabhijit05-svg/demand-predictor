import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  BellRing,
  Bot,
  CloudUpload,
  LineChart,
  Sparkles,
  TrendingUp,
} from "lucide-react";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DemandIQ — AI Market Demand Prediction for Retailers" },
      {
        name: "description",
        content:
          "Forecast product demand with AI, get inventory recommendations, and avoid overstocking or understocking. Upload your sales CSV and see predictions in seconds.",
      },
      { property: "og:title", content: "DemandIQ — AI Market Demand Prediction" },
      {
        property: "og:description",
        content:
          "Upload sales data, let AI forecast the next 7–30 days, and stock exactly what you need.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: CloudUpload, title: "Upload sales", body: "Drop a CSV of product, date and quantity." },
  { icon: Sparkles, title: "AI forecasts", body: "Demand predicted for the next 7–30 days." },
  { icon: BarChart3, title: "Stock smarter", body: "Recommended stock levels per product." },
  { icon: BellRing, title: "Get alerted", body: "Warned when demand outruns your stock." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <section className="header-gradient rounded-b-[2.5rem] px-6 pb-16 pt-14 text-header-foreground">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-header-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5" /> AI powered
          </span>
          <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
            Predict demand before your shelves decide for you.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-header-foreground/70 sm:text-base">
            DemandIQ turns your historical sales into a clear forecast, recommended stock levels
            and instant high-demand alerts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-float transition-transform hover:scale-[1.03]"
            >
              Get started free
            </Link>
            <Link
              to="/auth"
              className="rounded-full border border-header-foreground/25 px-6 py-3 text-sm font-semibold transition-colors hover:bg-header-foreground/10"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-10 grid max-w-3xl gap-4 px-6 pb-16 sm:grid-cols-2">
        {steps.map((s) => (
          <div
            key={s.title}
            className="rounded-3xl border border-border bg-card p-5 shadow-card transition-transform hover:-translate-y-1"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <s.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-bold text-card-foreground">{s.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
