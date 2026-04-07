"use client";

import { useState } from "react";
import { User, Mail, Building, Shield, Lock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useDashboard } from "../layout";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function SettingsPage() {
  const { tenant } = useDashboard();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(tenant.display_name || "");
  const [saving, setSaving] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState((tenant as any).default_system_prompt || "");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("tenants")
      .update({ display_name: displayName })
      .eq("id", tenant.id);

    setSaving(false);
    if (error) { toast("error", error.message); return; }
    toast("success", "Profile updated");
  };

  const handleSaveSystemPrompt = async () => {
    setSavingPrompt(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("tenants")
      .update({ default_system_prompt: systemPrompt || null })
      .eq("id", tenant.id);

    setSavingPrompt(false);
    if (error) { toast("error", error.message); return; }
    toast("success", "Default system prompt saved. It will be injected into all API requests.");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast("warning", "Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { toast("error", "Passwords don't match"); return; }

    setChangingPw(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setChangingPw(false);
    if (error) { toast("error", error.message); return; }
    setNewPassword("");
    setConfirmPassword("");
    toast("success", "Password updated successfully");
  };

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account settings." />

      {/* Profile */}
      <Card className="mb-6">
        <CardContent>
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Display Name</label>
              <Input icon={<User size={16} />} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Email</label>
              <Input icon={<Mail size={16} />} type="email" value={tenant.email} disabled className="opacity-50" />
            </div>
            <Button onClick={handleSaveProfile} loading={saving}>Save Changes</Button>
          </div>
        </CardContent>
      </Card>

      {/* Default System Prompt */}
      <Card className="mb-6">
        <CardContent>
          <h2 className="text-lg font-semibold mb-1">Default System Prompt</h2>
          <p className="text-xs text-white/40 mb-4">
            This prompt is automatically injected into every API request that doesn&apos;t include its own system message.
            Use it to customize the AI&apos;s behavior across all your applications.
          </p>
          <div className="space-y-4 max-w-lg">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful customer support agent for Acme Corp. Always be polite and reference our knowledge base..."
              rows={5}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm outline-none focus:border-white/30 resize-none"
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveSystemPrompt} loading={savingPrompt} variant="secondary">
                <MessageSquare size={14} /> Save System Prompt
              </Button>
              {systemPrompt && (
                <button onClick={() => { setSystemPrompt(""); handleSaveSystemPrompt(); }} className="text-xs text-white/30 hover:text-white/50">
                  Clear
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/25">
              Tip: You can also set per-API-key system prompts for different apps. The priority is: per-request &gt; per-key &gt; this default.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="mb-6">
        <CardContent>
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">New Password</label>
              <Input icon={<Lock size={16} />} type="password" placeholder="Min 8 characters"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Confirm Password</label>
              <Input icon={<Lock size={16} />} type="password" placeholder="Repeat password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={handleChangePassword} loading={changingPw} variant="secondary">
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card className="mb-6">
        <CardContent>
          <h2 className="text-lg font-semibold mb-4">Plan</h2>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Shield size={16} className="text-white/30" />
                <span className="text-sm font-medium capitalize">{tenant.plan} Plan</span>
                <Badge variant="success">Current</Badge>
              </div>
              <p className="text-xs text-white/40 mt-1">
                {tenant.plan === "free" ? "100 requests/mo, read-only tools" :
                 tenant.plan === "pro" ? "5,000 requests/mo, all tools" :
                 "50,000 requests/mo, all tools + custom"}
              </p>
            </div>
            {tenant.plan === "free" && (
              <Link href="/dashboard/usage"><Button variant="upgrade">Upgrade to Pro</Button></Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger */}
      <Card className="border-red-500/15">
        <CardContent>
          <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-white/40">Permanently delete your account and all data.</p>
            </div>
            <Button variant="danger" onClick={() => toast("warning", "Contact support to delete your account")}>
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
