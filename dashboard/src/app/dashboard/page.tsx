"use client";

import { BarChart3, Key, MessageSquare, Wrench, ArrowUpRight, Zap } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useDashboard } from "./layout";
import { getPlanLimit } from "@/lib/db";

export default function DashboardOverview() {
  const { tenant, monthlyUsed } = useDashboard();
  const limit = getPlanLimit(tenant.plan);
  const remaining = Math.max(limit - monthlyUsed, 0);
  const toolCount = 42; // All tools available on every plan

  return (
    <div>
      <PageHeader title="Dashboard" description={`Welcome back, ${tenant.display_name || tenant.email}.`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatCard icon={<BarChart3 size={18} />} iconColor="text-green-400" value={`${monthlyUsed} / ${limit}`} label="Requests Used" sub={`${remaining} remaining`} />
        <StatCard icon={<Key size={18} />} iconColor="text-blue-400" value="-" label="API Keys" sub="View in API Keys" />
        <StatCard icon={<MessageSquare size={18} />} iconColor="text-violet-400" value="-" label="Sessions" sub="View in Sessions" />
        <StatCard icon={<Wrench size={18} />} iconColor="text-amber-400" value={`${toolCount}`} label="Tools Available" sub={`${tenant.plan} plan`} />
      </div>

      <Card className="mb-8">
        <CardContent>
          <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: "1", title: "Add your LLM key", desc: "Configure your provider credentials (BYOK)", href: "/dashboard/providers" },
              { step: "2", title: "Create an API key", desc: "Generate a LLMPowerUp key for your app", href: "/dashboard/api-keys" },
              { step: "3", title: "Make your first call", desc: "Send a request to the agent API", href: "/dashboard/docs" },
            ].map((item) => (
              <Link key={item.step} href={item.href}
                className="p-4 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/[0.03] transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">{item.step}</span>
                  <span className="font-medium text-sm">{item.title}</span>
                  <ArrowUpRight size={14} className="ml-auto text-white/15 group-hover:text-white/50 transition-colors shrink-0" />
                </div>
                <p className="text-xs text-white/40 pl-10">{item.desc}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <EmptyState icon={<Zap size={28} />} title="No activity yet" description="Make your first API call to see recent activity here." />
        </CardContent>
      </Card>
    </div>
  );
}
