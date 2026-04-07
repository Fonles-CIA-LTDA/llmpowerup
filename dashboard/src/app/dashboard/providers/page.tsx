"use client";

import { useState, useEffect } from "react";
import { Check, Eye, EyeOff, Shield, ExternalLink, Zap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useDashboard } from "../layout";
import { getProviderCredentials } from "@/lib/db";
import { createClient } from "@/lib/supabase";

interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  keyPrefix: string;
  keyPlaceholder: string;
  signupUrl: string;
  signupLabel: string;
  required: boolean;
  color: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: "OR",
    description: "Unified LLM gateway — 300+ models from Anthropic, OpenAI, Google, Meta, and more.",
    keyPrefix: "sk-or-",
    keyPlaceholder: "sk-or-v1-...",
    signupUrl: "https://openrouter.ai/settings/keys",
    signupLabel: "openrouter.ai",
    required: true,
    color: "from-violet-500/20 to-blue-500/20",
  },
  {
    id: "brave",
    name: "Brave Search",
    icon: "B",
    description: "Powers the WebSearch tool — lets the agent search the internet in real-time.",
    keyPrefix: "BSA",
    keyPlaceholder: "BSAxxxxxxxxxxxxxxxxxxxxxxxx",
    signupUrl: "https://brave.com/search/api/",
    signupLabel: "brave.com/search/api",
    required: false,
    color: "from-orange-500/20 to-red-500/20",
  },
];

export default function ProvidersPage() {
  const { tenant } = useDashboard();
  const { toast } = useToast();
  const [configured, setConfigured] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProviderCredentials(tenant.id).then((creds) => {
      setConfigured(new Set(creds.map((c) => c.provider_id)));
    });
  }, [tenant.id]);

  const handleSave = async (provider: ProviderConfig) => {
    if (!apiKey.trim()) { toast("warning", `Enter your ${provider.name} API key`); return; }
    setSaving(true);

    const supabase = createClient();
    const encrypted = Array.from(new TextEncoder().encode(apiKey));
    const { error } = await supabase.from("provider_credentials").upsert({
      tenant_id: tenant.id,
      provider_id: provider.id,
      encrypted_key: encrypted,
      label: "default",
    }, { onConflict: "tenant_id,provider_id,label" });

    setSaving(false);
    if (error) { toast("error", error.message); return; }
    setConfigured(new Set([...configured, provider.id]));
    setEditing(null);
    setApiKey("");
    setShowKey(false);
    toast("success", `${provider.name} API key saved`);
  };

  return (
    <div>
      <PageHeader title="Provider Setup" description="Configure your API keys to unlock all features." />

      <Card className="mb-6 border-blue-500/10 bg-blue-500/[0.03]">
        <CardContent className="flex flex-col sm:flex-row items-start gap-4">
          <Shield size={20} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white/70 mb-1">
              All keys are <strong className="text-white">BYOK (Bring Your Own Key)</strong> — you pay providers directly. LLMPowerUp only charges for platform usage (requests/month).
            </p>
            <p className="text-xs text-white/40">Keys are stored encrypted. We never see or use them for anything else.</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {PROVIDERS.map((p) => {
          const isConfigured = configured.has(p.id);
          const isEditing = editing === p.id;

          return (
            <Card key={p.id} className="overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center text-sm font-bold shrink-0`}>
                      {p.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{p.name}</p>
                        {p.required && <Badge variant="info" className="text-[9px]">Required</Badge>}
                        {!p.required && <Badge variant="default" className="text-[9px]">Optional</Badge>}
                      </div>
                      <p className="text-xs text-white/40 mt-0.5 max-w-md">{p.description}</p>
                      <a href={p.signupUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-400/70 hover:text-blue-400 mt-1.5">
                        Get key at {p.signupLabel} <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isConfigured && <Badge variant="success"><Check size={10} /> Connected</Badge>}
                    <Button variant="secondary" size="sm" onClick={() => { setEditing(isEditing ? null : p.id); setApiKey(""); setShowKey(false); }}>
                      {isConfigured ? "Update" : "Add Key"}
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <label className="text-xs text-white/40 mb-2 block font-mono">{p.id.toUpperCase()}_API_KEY</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <input type={showKey ? "text" : "password"}
                          placeholder={p.keyPlaceholder}
                          value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSave(p)}
                          className="w-full p-3 pr-10 bg-white/5 border border-white/10 rounded-lg text-sm outline-none focus:border-white/30 font-mono"
                          autoFocus />
                        <button onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                          {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleSave(p)} loading={saving}>Save</Button>
                        <Button variant="secondary" onClick={() => { setEditing(null); setApiKey(""); }}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* What each key unlocks */}
      <Card className="mt-6">
        <CardContent>
          <h3 className="text-sm font-semibold mb-3">What each key unlocks</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center text-[10px] font-bold">OR</div>
                <span className="text-xs font-medium">OpenRouter</span>
              </div>
              <p className="text-[11px] text-white/40">Chat completions, agent mode, all 42 tools, 300+ models. Required for everything.</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center text-[10px] font-bold">B</div>
                <span className="text-xs font-medium">Brave Search</span>
              </div>
              <p className="text-[11px] text-white/40">WebSearch tool — the agent can search the internet. Free: 2,000 queries/mo.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
