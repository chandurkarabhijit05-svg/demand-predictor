# Welcome to your Lovable project
# Demand Predictor for Lovable – Detailed Documentation

This project was built with [Lovable](https://lovable.dev).
This project implements a client-side and server-side stack to forecast product demand, generate actionable insights, and prepare restock recommendations. It integrates historical sales data, lightweight statistical forecasting, and optional AI-assisted predictions when credits/keys are available.

## Build with Lovable
Contents
- Project overview
- Architecture and data model
- Data ingestion and ETL
- Forecasting logic and algorithms
- Insights and recommendations
- AI-powered predictions (optional)
- API surface and server functions
- Supabase schema and usage
- UI/data visualization components
- Running locally
- Deployment and hosting
- Validation and testing
- Security, privacy, and maintenance
- Appendix: file map and diagrams

Open your project in the [Lovable editor](https://lovable.dev) and keep building.
A note on Lovable: This project is designed to plug into Lovable workflows. If you publish changes back to Lovable, follow Lovable guidelines about no-history-rewriting when syncing with Lovable-connected repositories.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.
---

## Development
Project overview
- Tech stack: React + TypeScript (Vite), TanStack Start, Supabase, and a small data-science layer for forecasting.
- Primary goal: Given historical sales data, provide per-product demand forecasts, compute stock recommendations, and surface actionable insights for inventory planning.
- Data sources: Historical sales (date, product, category, quantity) stored in Supabase; optional prediction data stored back into Supabase.
- Core algorithms:
  - Forecasting: Per-product linear regression on daily sales history, with gap-filling for missing dates.
  - Stock and insights: Simple stock-on-hand proxy, restock recommendations, and trend-based insights.
  - AI fallback: Optional AI-based predictions if Lovable AI endpoints and keys are configured.

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).
---

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
Architecture and data model
High-level data flow
1. Sales data is ingested (CSV upload) and stored in Supabase table sales_data.
2. The forecasting module aggregates by product, fills gaps, and fits a linear regression model to historical daily quantities.
3. A horizon forecast is produced for a configurable number of days (horizonDays).
4. For each product, the system computes:
   - history (date, quantity)
   - forecast (date, predicted quantity)
   - slope, average daily sales, total predicted, total sold
   - trend and change percentage
5. Insights are derived from forecasts and stock estimates to inform restocking decisions.
6. Predictions (per product) can be exported as CSV or stored back into Supabase for downstream dashboards.

Key data structures (TypeScript types from the codebase)
- SaleRow (demand.ts):
  - product_name: string
  - category: string
  - date: string (YYYY-MM-DD)
  - quantity: number
- PredictionRow (demand.ts):
  - id, product_name, category, predicted_quantity, trend, current_stock, recommended_stock, horizon_days
  - user_id, created_at (timestamps managed by Supabase)
- ProductForecast (forecast.ts):
  - product: string
  - category: string
  - history: SeriesPoint[] (date, quantity)
  - forecast: SeriesPoint[] (date, quantity)
  - slope: number
  - avgPerDay: number
  - totalPredicted: number
  - totalSold: number
  - trend: 'up'|'down'|'flat'
  - changePercent: number
- SeriesPoint (forecast.ts): date: string, quantity: number

Supabase schema (core tables)
- sales_data
  - id: string
  - user_id: string
  - product_name: string
  - category: string
  - date: string (YYYY-MM-DD)
  - quantity: number
  - created_at: string
- predictions
  - id: string
  - user_id: string
  - product_name: string
  - category: string
  - predicted_quantity: number
  - trend: string
  - current_stock: number
  - horizon_days: number
  - recommended_stock: number
  - created_at: string

Note: The TypeScript types for the database surface are auto-generated to reflect the public schema. See src/integrations/supabase/types.ts for a full API surface.

---

Data ingestion and ETL
- CSV parsing (parseSalesCsv in lib/demand.ts):
  - Expects header with product_name, date, quantity and optional category.
  - Validates rows and normalizes dates to ISO (YYYY-MM-DD).
  - Filters out invalid rows.
- Data flow:
  - After parsing, sales data is stored in sales_data with user_id association.
  - The forecasting module reads from sales_data, groups by product, and builds per-product histories.

---

Forecasting logic and algorithms
Primary algorithm: Ordinary Least Squares (OLS) linear regression on daily quantities per product
- Helper: toDayNumber(date) converts a date string to an integer day counter.
- Gap filling: For each product, missing calendar days are filled with 0 quantity in the history to reflect true calendar activity.
- Regression: linearRegression(points) computes slope and intercept using standard OLS on transformed day indices.
- Forecast horizon: forecast for horizonDays beyond the last known date, using the regression line y = intercept + slope * x.
- Output: per-product ProductForecast including history, forecast, slope, and aggregate metrics.
- Key derived metrics:
  - totalSold: sum of historical quantities
  - avgPerDay: totalSold / number of historical days
  - totalPredicted: sum of forecasted quantities over horizon
  - changePercent: (forecast average - historical average) / historical average
  - trend: 'up' if changePercent > 5, 'down' if changePercent < -5, else 'flat'

Insights generation
- buildInsights(forecasts, bufferPercent):
  - Adds a best-seller insight for the top forecasted product.
  - Generates trend insights (up/down) for up to 12 products with severity based on magnitude of change.
  - Estimates stock and triggers stockout/restock warnings based on horizon demand vs on-hand stock.
  - Returns a sorted list of insights by severity, limited to 24.

Stock estimation and restocking
- estimatedStock(f): returns an on-hand stock proxy: avgPerDay * horizonDays * 0.7
- forecast-based recommendations consider a buffer percentage (default 20%) to derive restock quantities.

CSV export and download
- forecastsToCsv(forecasts, bufferPercent): produces a CSV with per-forecast rows including product, category, date, predicted_quantity, trend, estimated_stock, and restock recommendations.
- downloadCsv(filename, csv): utility to trigger a browser download of the generated CSV.

Fallback AI-based predictions
- predictions.functions.ts (generatePredictions):
  - Attempts to fetch sales data from Supabase (sales_data table).
  - If Lovable AI key is configured (LOVABLE_API_KEY), sends a compact data payload to Lovable AI endpoint to receive JSON predictions.
  - On failure or missing AI keys, falls back to a statistical approach (fallbackPredictions) that estimates demand per product as per-day sales scaled by horizon days.
  - Writes the per-product predictions into the predictions table for later use and UI display.

Notes on AI integration
- The code uses Lovable's AI gateway if LOVABLE_API_KEY is present in environment variables.
- If the AI gateway rate-limits or credits are exhausted, a friendly error is surfaced and the system reverts to the statistical fallback.
- The AI flow is designed to be resilient: if AI predictions fail, the system gracefully falls back to statistics without failing the entire operation.

---

API surface and server functions
- generatePredictions: a TanStack server function exposed on the server that:
  - Validates input (horizonDays 7-30, default 7; bufferPercent 0-100, default 20)
  - Requires Supabase-authenticated context
  - Reads sales_data, optionally calls AI, computes predictions, stores in predictions table, and returns a summary with optional alerts.
- Authentication: enforced via requireSupabaseAuth in auth-middleware.ts, using JWT-like tokens to identify user_id.
- Key environment variables:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_PUBLISHABLE_KEY
  - LOVABLE_API_KEY (optional for AI predictions)

---

UI and visualization (brief)
- The UI renders demand charts, product cards, and insights using components under src/components/demand and src/components/ui.
- Forecast history and forecast horizons are visualized with charts (Chart.tsx, demand-chart.tsx, charts.tsx).
- The app sidebar and layout components provide a cohesive navigation experience.

Key UI entry points (files to explore)
- src/router.tsx, src/start.ts: app bootstrap and route tree
- src/components/demand/demand-chart.tsx: per-product chart rendering
- src/components/demand/charts.tsx: charting utilities and data mapping
- src/lib/forecast.ts: forecasting logic used by UI and export tools

---

Running locally
Prerequisites
- Node.js and npm
- A Supabase project (optional for remote data) and environment variables configured locally
- A GitHub repository if you want to push the code

Local setup steps
1) Install dependencies
   npm install
2) Run the development server
   npm run dev
3) Optional: build for production
   npm run build

Environment configuration notes
- Create a .env file (or set in your hosting environment) with:
  - SUPABASE_URL=<your-supabase-url>
  - SUPABASE_PUBLIC_ANON_KEY=<your-supabase-key>
  - LOVABLE_API_KEY=<your Lovable AI key, optional>
- This project uses Vite env prefixes (VITE_*) for client-side env vars.

Data seeding and sample data
- To test forecasting locally, seed the sales_data table with sample CSV data parsed by parseSalesCsv (demand.ts).
- You can also manually insert rows via Supabase UI or API to exercise the forecasting logic.

---

Deployment, hosting, and Lovable integration
- The project is built to run in Lovable editor and Lovable Cloud environment.
- When pushing to GitHub, ensure you follow Lovable's policy to avoid rewriting published git history (no force-push, etc.).
- If you deploy with Lovable, ensure environment variables are configured in Lovable Cloud and that the Supabase instance is accessible.

---

Validation and testing
- Unit-level tests: none are included in this initial pass. You can add tests around forecast.ts functions (linearRegression, buildForecasts) using your preferred test framework (e.g., Jest).
- Manual testing: verify that CSV ingestion populates sales_data, then trigger generatePredictions to compute per-product forecasts and see outputs in predictions.

---

Security, privacy, and maintenance
- Data at rest: stored in Supabase tables; ensure access permissions are configured correctly to protect user data.
- Authentication: server function requires a valid token; ensure your client sends the Authorization header as a Bearer token.
- Secrets: Lovable AI key and Supabase keys are environment secrets; do not commit them to the repository.
- Maintenance: keep dependencies up-to-date (package.json). The codebase uses TypeScript and React; align tooling (linting, formatting) accordingly.

---

Appendix: file map and diagrams
- src/lib/forecast.ts: forecasting and forecasting utilities
- src/lib/demand.ts: data models and CSV parser
- src/lib/predictions.functions.ts: server function for AI/statistical predictions
- src/integrations/supabase/*: Supabase client, auth, and middleware
- src/routes/*: app routing
- public/: static assets
- supabase/: schema and types for database integration

Mermaid diagram: data flow
```
flowchart TD
  A[User uploads sales CSV] --> B[Parse CSV (parseSalesCsv)]
  B --> C[Store in sales_data (Supabase)]
  C --> D[Forecasting (buildForecasts) per product]
  D --> E[Forecast history + horizon]
  D --> F[Insights (buildInsights)]
  D --> G[CSV export (forecastsToCsv)]
  G --> H[Download CSV]
  D --> I[Store predictions in predictions table]
  I --> J[UI displays forecast & insights]
```

## Built with
---

- TanStack Start
- TypeScript
- React
- Tailwind CSS
If you’d like, I can also tailor this README to your exact needs (e.g., add more diagrams, expand on Supabase schema, or include a quick-start script). Additionally, I can prepare a ready-to-run GitHub push workflow or a patch/diff for a commit once you provide a target repository URL.
