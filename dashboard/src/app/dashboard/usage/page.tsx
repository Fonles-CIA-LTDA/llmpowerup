"use client";

import { Zap, TrendingUp, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useDashboard } from "../layout";
import { getPlanLimit, getUsageStats } from "@/lib/db";
import { Check } from "lucide-react";
import Link from "next/link";

const PLANS = [
  {
    id: "free", name: "Free", price: "$0", period: "",
    requests: "100 requests/mo",
    features: ["All 42 tools included", "5 req/min", "300+ models via OpenRouter", "Community support"],
  },
  {
    id: "pro", name: "Pro", price: "$30", period: "/mo", highlight: true,
    requests: "10,000 requests/mo",
    features: ["All 42 tools included", "60 req/min", "300+ models via OpenRouter", "Priority support"],
  },
  {
    id: "enterprise", name: "Enterprise", price: "$199", period: "/mo",
    requests: "100,000 requests/mo",
    features: ["All 42 tools + custom", "300 req/min", "300+ models via OpenRouter", "Dedicated support"],
  },
];

export default function UsagePage() {
  const { tenant, monthlyUsed } = useDashboard();
  const [daily, setDaily] = useState(0);
  const limit = getPlanLimit(tenant.plan);
  const remaining = Math.max(limit - monthlyUsed, 0);
  const pctUsed = limit > 0 ? Math.min((monthlyUsed / limit) * 100, 100) : 0;

  useEffect(() => {
    getUsageStats(tenant.id).then((s) => setDaily(s.daily));
  }, [tenant.id]);

  const handleUpgrade = (planId: string) => {
    // TODO: Stripe checkout session
    window.open(`https://buy.stripe.com/test_${planId}`, "_blank");
  };

  return (
    <div>
      <PageHeader title="Usage & Billing" description="Track your API usage and manage your plan." />

      {/* Usage stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
          <Zap size={18} className="text-amber-400" />
          <p className="text-3xl font-bold mt-3">{monthlyUsed} <span className="text-lg text-white/30">/ {limit}</span></p>
          <p className="text-xs text-white/40 mt-1">Requests this month</p>
          <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pctUsed > 80 ? "bg-red-500" : pctUsed > 50 ? "bg-amber-500" : "bg-green-500"}`}
              style={{ width: `${pctUsed}%` }}
            />
          </div>
        </div>
        <StatCard icon={<TrendingUp size={18} />} iconColor="text-blue-400" value={`${daily}`} label="Requests today" />
        <StatCard icon={<Clock size={18} />} iconColor="text-violet-400" value={`${remaining}`} label="Remaining this month" />
      </div>

      {/* How it works */}
      <Card className="mb-8">
        <CardContent>
          <h2 className="text-lg font-semibold mb-3">How it works</h2>
          <p className="text-sm text-white/50">
            <strong className="text-white">1 request = 1 API call.</strong> No matter how many tools run, how many sub-agents spawn, or how long the response streams.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="p-3 rounded-lg bg-white/[0.03]"><p className="text-xs text-white/40">Simple chat</p><p className="text-lg font-bold">1 request</p></div>
            <div className="p-3 rounded-lg bg-white/[0.03]"><p className="text-xs text-white/40">Agent + 5 tools</p><p className="text-lg font-bold">1 request</p></div>
            <div className="p-3 rounded-lg bg-white/[0.03]"><p className="text-xs text-white/40">10-turn convo</p><p className="text-lg font-bold">1 request</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <h2 className="text-lg font-semibold mb-4">Plans</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((p) => {
          const isCurrent = p.id === tenant.plan;
          return (
            <div key={p.id}
              className={`p-5 rounded-xl border ${
                p.highlight ? "border-blue-500 bg-blue-500/5" : isCurrent ? "border-green-500/30 bg-green-500/5" : "border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                {isCurrent && <Badge variant="success">Current</Badge>}
              </div>
              <p className="text-3xl font-bold">{p.price}<span className="text-sm font-normal text-white/40">{p.period}</span></p>
              <p className="text-sm text-white/50 mt-1">{p.requests}</p>
              <ul className="mt-4 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="text-xs text-white/50 flex items-center gap-2">
                    <Check size={12} className="text-white/25 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && p.id !== "free" && (
                <Button
                  variant={p.highlight ? "upgrade" : "secondary"}
                  className="w-full mt-4"
                  onClick={() => handleUpgrade(p.id)}
                >
                  {p.id === "enterprise" ? "Contact Sales" : "Upgrade to Pro"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
