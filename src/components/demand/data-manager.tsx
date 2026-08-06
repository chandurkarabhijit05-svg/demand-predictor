import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDemandData } from "@/hooks/use-demand-data";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DataManager() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useDemandData();
  const [busy, setBusy] = useState<string | null>(null);

  const products = useMemo(() => {
    const map = new Map<string, { rows: number; units: number; last: string }>();
    for (const s of data?.sales ?? []) {
      const cur = map.get(s.product_name) ?? { rows: 0, units: 0, last: s.date };
      cur.rows += 1;
      cur.units += s.quantity;
      if (s.date > cur.last) cur.last = s.date;
      map.set(s.product_name, cur);
    }
    return [...map.entries()]
      .map(([product, v]) => ({ product, ...v }))
      .sort((a, b) => b.units - a.units);
  }, [data?.sales]);

  async function remove(product: string | null) {
    setBusy(product ?? "__all__");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Session expired. Please sign in again.");
      let query = supabase.from("sales_data").delete().eq("user_id", userId);
      if (product) query = query.eq("product_name", product);
      const { error } = await query;
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["demand"] });
      toast.success(product ? `Deleted all rows for ${product}.` : "All sales data deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || products.length === 0) return null;

  return (
    <section className="glass rise-in overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-brand" />
          <p className="text-sm font-semibold">
            Your saved data — {products.length} product{products.length === 1 ? "" : "s"}
          </p>
        </div>
        <ConfirmDelete
          title="Delete all sales data?"
          description="This permanently removes every uploaded row from your workspace. Forecasts and insights will reset."
          onConfirm={() => remove(null)}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            className="rounded-full text-destructive"
          >
            {busy === "__all__" ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-3.5 w-3.5" />
            )}
            Delete all
          </Button>
        </ConfirmDelete>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Rows</th>
              <th className="px-4 py-3 text-right">Units</th>
              <th className="px-4 py-3">Latest date</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.product} className="border-t border-border/50">
                <td className="px-4 py-2.5 font-medium">{p.product}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {p.rows}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.units}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.last}</td>
                <td className="px-4 py-2.5 text-right">
                  <ConfirmDelete
                    title={`Delete ${p.product}?`}
                    description={`This removes ${p.rows} saved row${p.rows === 1 ? "" : "s"} for ${p.product}. This cannot be undone.`}
                    onConfirm={() => remove(p.product)}
                  >
                    <button
                      aria-label={`Delete ${p.product}`}
                      disabled={busy !== null}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {busy === p.product ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </ConfirmDelete>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConfirmDelete({
  title,
  description,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
