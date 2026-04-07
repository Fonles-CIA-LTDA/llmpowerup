"use client";

import { useState, useEffect } from "react";
import { Search, CheckCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const levelColors: Record<string, "success" | "info" | "warning" | "error" | "default"> = {
  None: "success", ReadOnly: "info", Write: "warning", Execute: "error", Dangerous: "error",
};

interface ToolInfo {
  name: string;
  description: string;
  permission_level: string;
  available: boolean;
}

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Fetch real tools from the Rust backend via proxy
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/v1/tools`, {
      headers: { "Authorization": "Bearer clst_test_abc123xyz789def456ghi" },
    })
      .then((r) => r.json())
      .then((data) => {
        setTools(data.tools || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = tools.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
  );

  // Group by permission level
  const groups: Record<string, ToolInfo[]> = {};
  for (const t of filtered) {
    const level = t.permission_level;
    if (!groups[level]) groups[level] = [];
    groups[level].push(t);
  }

  const groupOrder = ["None", "ReadOnly", "Write", "Execute"];
  const groupLabels: Record<string, string> = {
    None: "Informational", ReadOnly: "Read-Only", Write: "File Write", Execute: "Execution",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Tools" description={`${tools.length} built-in tools powered by LLMPowerUp engine.`} />

      <Input placeholder="Search tools..." value={search} onChange={(e) => setSearch(e.target.value)}
        icon={<Search size={16} />} className="mb-6" />

      {groupOrder.map((level) => {
        const items = groups[level];
        if (!items?.length) return null;
        return (
          <div key={level} className="mb-6">
            <h3 className="text-xs text-white/30 uppercase tracking-wider mb-3 font-medium">
              {groupLabels[level] || level} ({items.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((t) => (
                <Card key={t.name} className="p-3.5 sm:p-4 flex items-center gap-3">
                  <CheckCircle size={16} className="text-green-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold font-mono">{t.name}</span>
                      <Badge variant={levelColors[t.permission_level] || "default"}>{t.permission_level}</Badge>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{t.description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      <Card className="mt-2">
        <CardContent>
          <p className="text-sm text-white/50">
            All <strong className="text-white">{tools.length} tools</strong> are included in every plan, including Free.
            Full agent toolkit — running code, editing files, web search, sub-agents, and more.
            The only difference between plans is requests/month and rate limits.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
