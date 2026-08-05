import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SaleRow } from "@/lib/demand";

export interface DemandData {
  storeName: string;
  sales: SaleRow[];
}

export function useDemandData() {
  return useQuery<DemandData>({
    queryKey: ["demand"],
    queryFn: async () => {
      const [profileRes, salesRes] = await Promise.all([
        supabase.from("profiles").select("store_name").maybeSingle(),
        supabase
          .from("sales_data")
          .select("product_name, category, date, quantity")
          .order("date", { ascending: true })
          .limit(5000),
      ]);
      if (salesRes.error) throw salesRes.error;
      return {
        storeName: profileRes.data?.store_name ?? "My Store",
        sales: (salesRes.data ?? []) as SaleRow[],
      };
    },
  });
}
