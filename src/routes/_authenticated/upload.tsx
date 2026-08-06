import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseSalesCsv } from "@/lib/demand";
import type { SaleRow } from "@/lib/demand";
import { Button } from "@/components/ui/button";
import { DataManager } from "@/components/demand/data-manager";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload Sales Data — DemandIQ" },
      {
        name: "description",
        content:
          "Upload a CSV of product_name, date and quantity, preview the parsed rows and validate your sales data before forecasting.",
      },
      { property: "og:title", content: "Upload Sales Data — DemandIQ" },
      {
        property: "og:description",
        content: "Validate and preview your sales CSV before running demand predictions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function readFile(file: File) {
    setError(null);
    setRows([]);
    setFileName(file.name);
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("That file isn't a CSV. Export your sales as .csv and try again.");
      return;
    }
    if (file.size > 5_000_000) {
      setError("File is larger than 5 MB. Split it into smaller uploads.");
      return;
    }
    try {
      const parsed = parseSalesCsv(await file.text());
      setRows(parsed);
      toast.success(`${parsed.length} valid rows parsed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that CSV.");
    }
  }

  async function save() {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Session expired. Please sign in again.");
      const { error: insertError } = await supabase
        .from("sales_data")
        .insert(rows.map((r) => ({ ...r, user_id: userId })));
      if (insertError) throw insertError;
      await queryClient.invalidateQueries({ queryKey: ["demand"] });
      toast.success(`${rows.length} rows saved to your workspace.`);
      setRows([]);
      setFileName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rise-in">
        <h1 className="text-2xl font-black sm:text-3xl">Upload sales data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV columns: <code className="text-foreground">product_name, date, quantity</code> and an
          optional <code className="text-foreground">category</code>.
        </p>
      </header>

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void readFile(file);
        }}
        className={`glass rise-in rounded-3xl border-dashed p-10 text-center transition-colors ${
          dragging ? "border-brand bg-brand/10" : ""
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readFile(file);
          }}
        />
        <CloudUpload className="mx-auto h-9 w-9 text-brand" />
        <h2 className="mt-4 text-lg font-bold">Drop your CSV here</h2>
        <p className="mt-1 text-sm text-muted-foreground">or pick a file from your device</p>
        <Button
          className="mt-5 rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
          onClick={() => fileRef.current?.click()}
        >
          Choose CSV file
        </Button>
        {fileName ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <FileSpreadsheet className="h-3.5 w-3.5" /> {fileName}
          </p>
        ) : null}
      </section>

      {error ? (
        <div className="rise-in flex items-start gap-3 rounded-3xl border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Upload not valid</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <section className="glass rise-in overflow-hidden rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-low" />
              <p className="text-sm font-semibold">
                {rows.length} rows ready — showing first {Math.min(rows.length, 20)}
              </p>
            </div>
            <Button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save to workspace
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={`${r.product_name}-${r.date}-${i}`} className="border-t border-border/50">
                    <td className="px-4 py-2.5 font-medium">{r.product_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.category}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.date}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      ) : null}

      <DataManager />
    </div>
  );
}
