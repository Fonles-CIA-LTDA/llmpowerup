"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useDashboard } from "../layout";
import { getSessions, deleteSession } from "@/lib/db";
import Link from "next/link";

export default function SessionsPage() {
  const { tenant } = useDashboard();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessions(tenant.id).then((s) => {
      setSessions(s);
      setLoading(false);
    });
  }, [tenant.id]);

  const handleDelete = async (id: string) => {
    const ok = await deleteSession(id, tenant.id);
    if (ok) {
      setSessions(sessions.filter((s) => s.id !== id));
      toast("info", "Session deleted");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-white/30 text-sm">Loading sessions...</div>;
  }

  return (
    <div>
      <PageHeader title="Sessions" description="Browse and manage your agent sessions." />

      {sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquare size={28} />}
            title="No sessions yet"
            description="Each call to POST /v1/agent/run creates a session. Make your first API call to see it here."
            action={
              <Link href="/dashboard/docs" className="text-xs text-blue-400 hover:underline">
                View API docs
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id} className="overflow-hidden hover:border-white/20 transition-colors">
              <div className="p-4">
                <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <MessageSquare size={16} className="text-white/30" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-medium font-mono">{s.id.slice(0, 8)}</code>
                        <Badge variant={s.status === "active" ? "success" : "default"}>{s.status}</Badge>
                      </div>
                      <p className="text-xs text-white/40 mt-0.5 truncate">
                        {s.model} via {s.provider_id} &middot; {s.message_count} msgs &middot; {(s.total_tokens || 0).toLocaleString()} tokens
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-white/30">{new Date(s.created_at).toLocaleDateString()}</span>
                    <button onClick={() => handleDelete(s.id)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-white/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
