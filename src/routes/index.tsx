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
  { icon: Bot, title: "AI assistant", body: "Ask why a forecast moved and what to do next." },
  { icon: LineChart, title: "Compare products", body: "Multi-product trends on one chart." },
];

const stats = [
  { value: "7–30d", label: "Forecast horizon" },
  { value: "<5s", label: "Time to insight" },
  { value: "CSV", label: "Zero-setup import" },
];

function Landing() {
  return (
    <div className="aurora min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-sm font-black tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-brand-foreground">
            <BarChart3 className="h-4 w-4" />
          </span>
          DemandIQ
        </span>
        <Link
          to="/auth"
          className="rounded-full border border-border/60 px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-14 pt-10 text-center">
        <span className="rise-in glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-brand" /> AI powered forecasting
        </span>
        <h1 className="rise-in mx-auto mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Predict demand before your shelves decide for you.
        </h1>
        <p className="rise-in mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          DemandIQ turns historical sales into a clear forecast, recommended stock levels and
          instant high-demand alerts — in one glass dashboard.
        </p>
        <div className="rise-in mt-9 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-float transition-transform hover:scale-[1.03]"
          >
            Get started free
          </Link>
          <Link
            to="/auth"
            className="glass rounded-full px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent"
          >
            I already have an account
          </Link>
        </div>

        <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl px-4 py-5">
              <dt className="text-2xl font-black tracking-tight">{s.value}</dt>
              <dd className="mt-1 text-xs text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.title}
            className="glass rise-in rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="glass-strong flex h-11 w-11 items-center justify-center rounded-2xl text-brand">
              <s.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-bold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="glass-strong flex flex-col items-center gap-5 rounded-[2rem] p-10 text-center">
          <TrendingUp className="h-8 w-8 text-brand" />
          <h2 className="max-w-lg text-2xl font-black tracking-tight sm:text-3xl">
            Stop guessing. Start stocking with data.
          </h2>
          <Link
            to="/auth"
            className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-float transition-transform hover:scale-[1.03]"
          >
            Create your free account
          </Link>
        </div>
      </section>
    </div>
  );

}
