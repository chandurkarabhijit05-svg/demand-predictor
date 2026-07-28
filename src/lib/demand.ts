export type DemandTrend = "high" | "medium" | "low";

export interface PredictionRow {
  id: string;
  product_name: string;
  category: string;
  predicted_quantity: number;
  trend: string;
  current_stock: number;
  recommended_stock: number;
  horizon_days: number;
}

export interface SaleRow {
  product_name: string;
  category: string;
  date: string;
  quantity: number;
}

export const CATEGORY_ICONS: Record<string, string> = {
  All: "🗂️",
  Grocery: "🛒",
  Electronics: "🔌",
  Clothing: "👕",
  Beverages: "🥤",
  Home: "🏠",
  Beauty: "💄",
  General: "📦",
};

export function categoryIcon(name: string) {
  return CATEGORY_ICONS[name] ?? "🏷️";
}


export function trendLabel(trend: string): DemandTrend {
  return trend === "high" || trend === "low" ? trend : "medium";
}

export function parseSalesCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row.");

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    product: header.indexOf("product_name"),
    date: header.indexOf("date"),
    quantity: header.indexOf("quantity"),
    category: header.indexOf("category"),
  };
  if (idx.product < 0 || idx.date < 0 || idx.quantity < 0) {
    throw new Error("CSV must include product_name, date and quantity columns.");
  }

  const rows: SaleRow[] = [];
  for (const line of lines.slice(1, 2001)) {
    const cells = line.split(",").map((c) => c.trim());
    const product_name = cells[idx.product]?.slice(0, 120);
    const date = cells[idx.date];
    const quantity = Number(cells[idx.quantity]);
    if (!product_name || !date || Number.isNaN(quantity)) continue;
    if (Number.isNaN(Date.parse(date))) continue;
    rows.push({
      product_name,
      date: new Date(date).toISOString().slice(0, 10),
      quantity: Math.max(0, Math.round(quantity)),
      category: (idx.category >= 0 ? cells[idx.category] : "") || "General",
    });
  }
  if (rows.length === 0) throw new Error("No valid rows found in the CSV.");
  return rows;
}
