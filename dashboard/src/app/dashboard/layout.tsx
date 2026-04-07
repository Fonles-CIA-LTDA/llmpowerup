"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, createContext, useContext } from "react";
import {
  LayoutDashboard, Key, Server, BarChart3, MessageSquare, Play,
  Wrench, Settings, BookOpen, LogOut, CreditCard, Menu, X, Loader2,
} from "lucide-react";
import { ToastProvider } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase";
import { getTenant, getUsageStats, getPlanLimit, type Tenant } from "@/lib/db";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/playground", label: "Playground", icon: Play },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/providers", label: "Providers", icon: Server },
  { href: "/dashboard/usage", label: "Usage & Billing", icon: BarChart3 },
  { href: "/dashboard/sessions", label: "Sessions", icon: MessageSquare },
  { href: "/dashboard/tools", label: "Tools", icon: Wrench },
  { href: "/dashboard/docs", label: "API Docs", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// Context to share tenant data across dashboard pages
type DashCtx = { tenant: Tenant; monthlyUsed: number; refresh: () => void };
const DashboardContext = createContext<DashCtx | null>(null);
export function useDashboard() { return useContext(DashboardContext)!; }

function Sidebar({ tenant, monthlyUsed, onClose, onSignOut }: {
  tenant: Tenant; monthlyUsed: number; onClose?: () => void; onSignOut: () => void;
}) {
  const pathname = usePathname();
  const limit = getPlanLimit(tenant.plan);

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-lg font-bold tracking-tight" onClick={onClose}>
            LLMPowerUp
          </Link>
          <p className="text-xs text-white/40 mt-0.5">AI Backend-as-a-Service</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active ? "bg-white/10 text-white font-medium" : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <Link href="/dashboard/usage" onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors mb-2"
        >
          <CreditCard size={14} className="text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 capitalize">{tenant.plan} Plan</p>
            <p className="text-sm font-semibold">{monthlyUsed} / {limit} req</p>
          </div>
          {tenant.plan === "free" && <span className="text-xs text-blue-400 shrink-0">Upgrade</span>}
        </Link>
        <button onClick={onSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [monthlyUsed, setMonthlyUsed] = useState(0);

  const loadData = async () => {
    const t = await getTenant();
    if (!t) {
      router.replace("/login");
      return;
    }
    setTenant(t as Tenant);
    const usage = await getUsageStats(t.id);
    setMonthlyUsed(usage.monthly);
    setLoading(false);
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
      } else {
        loadData();
      }
    });
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading || !tenant) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <Loader2 size={24} className="animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={{ tenant, monthlyUsed, refresh: loadData }}>
      <ToastProvider>
        <div className="flex h-screen bg-zinc-950 text-white">
          <aside className="hidden lg:flex w-64 border-r border-white/10 flex-col shrink-0">
            <Sidebar tenant={tenant} monthlyUsed={monthlyUsed} onSignOut={handleSignOut} />
          </aside>

          {mobileOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
              <aside className="relative w-72 h-full bg-zinc-950 border-r border-white/10 shadow-2xl">
                <Sidebar tenant={tenant} monthlyUsed={monthlyUsed} onClose={() => setMobileOpen(false)} onSignOut={handleSignOut} />
              </aside>
            </div>
          )}

          <main className="flex-1 overflow-y-auto min-w-0">
            <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-zinc-950 sticky top-0 z-10">
              <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-white/10 rounded-lg">
                <Menu size={20} />
              </button>
              <span className="font-bold text-sm">LLMPowerUp</span>
            </div>
            <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">{children}</div>
          </main>
        </div>
      </ToastProvider>
    </DashboardContext.Provider>
  );
}
