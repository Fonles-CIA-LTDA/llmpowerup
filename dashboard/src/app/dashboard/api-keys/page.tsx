"use client";

import { useState, useEffect } from "react";
import { Plus, Copy, Trash2, Check, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useDashboard } from "../layout";
import { getApiKeys, revokeApiKey } from "@/lib/db";
import { createClient } from "@/lib/supabase";

export default function ApiKeysPage() {
  const { tenant } = useDashboard();
  const { toast } = useToast();
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadKeys = () => {
    getApiKeys(tenant.id).then((k) => { setKeys(k); setLoading(false); });
  };

  useEffect(() => { loadKeys(); }, [tenant.id]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) { toast("warning", "Enter a key name"); return; }
    setCreating(true);

    // Generate key client-side, hash it, store hash in DB
    const random = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
    const fullKey = `clst_${random}`;
    const keyPrefix = fullKey.slice(0, 12) + "...";

    // SHA-256 hash
    const encoded = new TextEncoder().encode(fullKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0")).join("");

    const supabase = createClient();
    const { error } = await supabase.from("api_keys").insert({
      tenant_id: tenant.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: newKeyName,
    });

    setCreating(false);
    if (error) {
      toast("error", `Failed to create key: ${error.message}`);
      return;
    }

    setCreatedKey(fullKey);
    setNewKeyName("");
    setShowCreate(false);
    loadKeys();
    toast("success", `API key "${newKeyName}" created`);
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast("success", "Copied to clipboard");
    }
  };

  const handleRevoke = async (keyId: string, name: string) => {
    const ok = await revokeApiKey(keyId, tenant.id);
    if (ok) { loadKeys(); toast("info", `Key "${name}" revoked`); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-white/30 text-sm">Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="API Keys" description="Manage your LLMPowerUp API keys."
        action={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> Create Key</Button>}
      />

      {/* New key reveal */}
      {createdKey && (
        <Card className="mb-6 border-green-500/20 bg-green-500/5">
          <div className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <Check size={16} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-400">API key created</p>
                <p className="text-xs text-white/40 mt-0.5">Copy it now — it won&apos;t be shown again.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-black/40 rounded-lg text-sm font-mono text-green-300 break-all select-all">{createdKey}</code>
              <Button variant="secondary" size="sm" onClick={handleCopy}><Copy size={14} /> Copy</Button>
            </div>
            <button onClick={() => setCreatedKey(null)} className="text-xs text-white/30 hover:text-white/50 mt-3">Dismiss</button>
          </div>
        </Card>
      )}

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <div className="p-4">
            <h3 className="font-medium text-sm mb-3">Create new API key</h3>
            <Input placeholder="Key name (e.g., Production)" value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="mb-3" autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} loading={creating}>Create</Button>
              <Button variant="secondary" onClick={() => { setShowCreate(false); setNewKeyName(""); }}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Keys list */}
      {keys.length === 0 && !createdKey ? (
        <Card>
          <EmptyState icon={<Key size={28} />} title="No API keys yet"
            description="Create your first API key to start using the LLMPowerUp API."
            action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Create Key</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden sm:block overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                  <th className="px-5 py-3">Name</th><th className="px-5 py-3">Key</th>
                  <th className="px-5 py-3">Created</th><th className="px-5 py-3">Last Used</th>
                  <th className="px-5 py-3">Status</th><th className="px-5 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 text-sm font-medium">{k.name}</td>
                    <td className="px-5 py-3.5 text-sm font-mono text-white/50">{k.key_prefix}</td>
                    <td className="px-5 py-3.5 text-sm text-white/40">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-sm text-white/40">{k.last_used ? new Date(k.last_used).toLocaleDateString() : "Never"}</td>
                    <td className="px-5 py-3.5"><Badge variant={k.is_active ? "success" : "default"}>{k.is_active ? "Active" : "Revoked"}</Badge></td>
                    <td className="px-5 py-3.5">
                      {k.is_active && (
                        <button onClick={() => handleRevoke(k.id, k.name)}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-white/20 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {keys.map((k) => (
              <Card key={k.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{k.name}</span>
                  <Badge variant={k.is_active ? "success" : "default"}>{k.is_active ? "Active" : "Revoked"}</Badge>
                </div>
                <p className="text-xs font-mono text-white/50 mb-2">{k.key_prefix}</p>
                <div className="flex items-center justify-between text-xs text-white/30">
                  <span>{new Date(k.created_at).toLocaleDateString()}</span>
                  {k.is_active && (
                    <button onClick={() => handleRevoke(k.id, k.name)}
                      className="p-1.5 rounded-lg text-white/20 hover:text-red-400"><Trash2 size={14} /></button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
