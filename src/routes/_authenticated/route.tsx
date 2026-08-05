import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/use-theme";
import { useDemandData } from "@/hooks/use-demand-data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { theme, toggle } = useTheme();
  const { data } = useDemandData();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-3 backdrop-blur-xl">
            <SidebarTrigger />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {data?.storeName ?? "My Store"}
            </p>
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </header>
          <main className="aurora min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
